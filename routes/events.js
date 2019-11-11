var express = require('express');
var router = express.Router();
const uuidv4 = require('uuid/v4');
const findIndex = require('lodash/findIndex');

const appConstants = require('../utils/constants');
const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');
const getGeneralProfilesMap = require('../utils/getGeneralProfilesMap');
const getFriendsProfilesMap = require('../utils/getFriendsProfilesMap');
const pushNotification = require('../utils/pushNotification');

// Events posted by users or by friends
router.get('/:sessionToken', function(req, res) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        const userId = objUser.userId;
        return getFriendsProfilesMap(STORE.connection, userId);
    })
    .then((friendsProfileMap) => {
        STORE.friendsProfileMap = friendsProfileMap;
        const arrFriendsUserIds = Object.keys(friendsProfileMap);
        arrFriendsUserIds.push(STORE.objUser.userId); // get current user's events as well

        return STORE.connection.collection(appConstants.EVENTS_TABLE).find({userId: {$in: arrFriendsUserIds}}).toArray();
    })
    .then((arrEvents) => {
        STORE.arrEvents = arrEvents;
        // This is a quick/easy fix for the 'joined by me' bug created from
        // moving guest lists into its own table
        return STORE.connection.collection(appConstants.GUEST_LIST_TABLE).find({userId: STORE.objUser.userId}).toArray();
    })
    .then((arrEventsUserJoined) => {
        // This is a quick/easy fix for the 'joined by me' bug created from
        // moving guest lists into its own table
        const arrEventsFormatted = STORE.arrEvents.map((event) => {
            if(findIndex(arrEventsUserJoined, (eventsJoined) => eventsJoined.eventId === event.eventId) !== -1){
                console.log('found index!')
                event.guestList = [STORE.objUser.userId];
            }
            else{
                console.log(event.eventId);
                console.log(event.eventId, arrEventsUserJoined.length);
            }
            return event;
        });
        return Promise.resolve(arrEventsFormatted);
    })
    .then((arrEvents) => {
        // Do something with outdated events
        const formattedEvents = arrEvents.map((event) => {
            if(event.userId === STORE.objUser.userId){
                // current user created the event
                event.associatedUserProfile = STORE.objUser;
            }
            else {
                event.associatedUserProfile = STORE.friendsProfileMap[event.userId];
            }

            return event;
        })
        res.send({
            success: true,
            message: '',
            events: formattedEvents.filter((event) => {
                if(STORE.objUser.currentAppVersion !== '1.6' && event.eventType === 'phone'){
                    return false;
                }
                return true;
            }),
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.delete('/:sessionToken/:eventId', function(req, res) {

    const { sessionToken, eventId } = req.params;
    const { title, guestList } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        const userId = objUser.userId;
        
        return STORE.connection.collection(appConstants.EVENTS_TABLE).deleteOne({
            eventId,
            userId,
        });
    })
    .then(() => {
        return STORE.connection.collection(appConstants.COMMENTS_TABLE).deleteMany({
            eventId,
        });
    })
    .then(() => {
        return STORE.connection.collection(appConstants.GUEST_LIST_TABLE).deleteMany({
            eventId,
        });
    })
    .then(() => {
        // Notify guest list of changes to the event.
        const promiseNotifications = [];
        for(let i = 0; i < guestList.length; i++){
            promiseNotifications.push(pushNotification(STORE.connection, guestList[i], 'changed-event', `${STORE.objUser.username} deleted event ${title}.`))
        }
        return Promise.all(promiseNotifications);
    })
    .then(() => {
        res.send({
            success: true,
            message: '',
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.get('/guest-list/:eventId/:sessionToken', function(req, res) {

    const { sessionToken, eventId } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then(() => {
        return STORE.connection.collection(appConstants.GUEST_LIST_TABLE).find({eventId}).toArray();
    })
    .then((guestList) => {
        STORE.guestList = guestList;

        const guestListUserIds = guestList.map((guest) => {
            return guest.userId;
        })

        return STORE.connection.collection(appConstants.USERS_TABLE).find({userId: {$in: guestListUserIds}}).toArray();
    })
    .then((arrProfiles) => {
        STORE.arrProfiles = arrProfiles;
        // Update count for home page render
        return STORE.connection.collection(appConstants.EVENTS_TABLE).updateOne({ eventId }, { $set: {guestListCount: STORE.guestList.length} });
    })
    .then(() => {
        const arrProfiles = STORE.arrProfiles;
        const profileMap = {};
        for(let i = 0; i < arrProfiles.length; i++){
            // DELETE ANY INFO FROM PROFILE THAT SHOULD NOT GET RETURNED TO CLIENT
            delete arrProfiles[i].sessionToken;
            delete arrProfiles[i].pushObject;

            profileMap[arrProfiles[i].userId] = arrProfiles[i];
        }

        const guestListFormatted = STORE.guestList.map((guest) => {
            guest.profile = profileMap[guest.userId];
            return guest;
        })

        res.send({
            success: true,
            guestList: guestListFormatted,
            message: ''
        })  

    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.post('/guest-list', function(req, res) {

    const { sessionToken, event} = req.body;
    const { eventId, title, userId } = event;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        const currentUserId = objUser.userId;
        return STORE.connection.collection(appConstants.GUEST_LIST_TABLE).insertOne({
            eventId,
            userId: currentUserId,
            confirmedDatetime: new Date().toISOString(),
        });
    })
    .then(() => {
        // Notify the event owner that someone joined their event
        return pushNotification(STORE.connection, userId, 'joined-event', `${STORE.objUser.username} joined ${title}.`);
    })
    .then(() => {
        res.send({
            success: true,
            message: ''
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.delete('/guest-list', function(req, res) {

    const { sessionToken, event } = req.body;
    const { eventId, title, userId } = event;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        const currentUserId = objUser.userId;
        return STORE.connection.collection(appConstants.GUEST_LIST_TABLE).deleteOne({
            eventId,
            userId: currentUserId,
        });
    })
    .then(() => {
        // Notify the event owner that someone left their event
        return pushNotification(STORE.connection, userId, 'left-event', `${STORE.objUser.username} left ${title}.`);
    })
    .then(() => {
        res.send({
            success: true,
            message: ''
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.post('/', function(req, res) {

    const { sessionToken, title, location, details, startDatetime, endDatetime, phoneNumber, passCode, meetingLink, eventType } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        const userId = objUser.userId;
        return STORE.connection.collection(appConstants.EVENTS_TABLE).insertOne({
            eventId: uuidv4(),
            userId,
            title, 
            location,
            details,
            commentCount: 0, // static for faster intial load
            guestListCount: 0, // static for faster intial load
            startDatetime: new Date(startDatetime).toISOString(),
            endDatetime: new Date(endDatetime).toISOString(),
            dateCreated: new Date().toISOString(),
            phoneNumber,
            passCode,
            meetingLink,
            eventType,
        });
    })
    .then(() => {
        // Notify anyone who starred this user that they posted a new event
        return STORE.connection.collection(appConstants.FRIENDS_TABLE).find({friendUserId: STORE.objUser.userId, starred: true}).toArray();
    })
    .then((arrUsersWhoStarredMe) => {
        const promiseNotifications = [];
        for(let i = 0; i < arrUsersWhoStarredMe.length; i++){
            promiseNotifications.push(pushNotification(STORE.connection, arrUsersWhoStarredMe[i].userId, 'new-event', `${STORE.objUser.username} posted a new event: ${title}.`))
        }
        return Promise.all(promiseNotifications);
    })
    .then(() => {
        res.send({
            success: true,
            message: ''
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.put('/:eventId', function(req, res) {

    const { eventId } = req.params;
    const { sessionToken, title, location, details, startDatetime, endDatetime, phoneNumber, passCode, meetingLink, eventType, guestList } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        const userId = objUser.userId;
        return STORE.connection.collection(appConstants.EVENTS_TABLE).updateOne({ eventId }, { $set: {
            userId,
            title, 
            location,
            details,
            startDatetime: new Date(startDatetime).toISOString(),
            endDatetime: new Date(endDatetime).toISOString(),
            phoneNumber,
            passCode,
            meetingLink,
            eventType,
            dateUpdated: new Date().toISOString(),
        } })
    })
    .then(() => {
        // Notify guest list of changes to the event.
        const promiseNotifications = [];
        for(let i = 0; i < guestList.length; i++){
            promiseNotifications.push(pushNotification(STORE.connection, guestList[i], 'changed-event', `${STORE.objUser.username} made changes to event ${title}.`))
        }
        return Promise.all(promiseNotifications);
    })
    .then(() => {
        res.send({
            success: true,
            message: ''
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.get('/comments/:eventId/:sessionToken', function(req, res) {
    const { sessionToken, eventId } = req.params;
    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(appConstants.COMMENTS_TABLE).find({eventId}).toArray();
    })
    .then((comments) => {
        STORE.comments = comments;
        const userIds = [];
        for(let i = 0; i < STORE.comments.length; i++){
            userIds.push(STORE.comments[i].userId);
        }
        return getGeneralProfilesMap(STORE.connection, userIds);
    })
    .then((profilesMap) => {
        const comments = STORE.comments.map((comment) => {
            if(profilesMap[comment.userId] !== undefined){
                comment.profilePic = profilesMap[comment.userId].profilePic;
                comment.username = profilesMap[comment.userId].username;
                comment.displayName = profilesMap[comment.userId].displayName;
            }
            else if(comment.userId === STORE.userObj.userId){
                comment.profilePic = STORE.userObj.profilePic;
                comment.username = STORE.userObj.username;
                comment.displayName = STORE.userObj.displayName;
            }
            else{
                console.log('not friends??', comment)
            }
            return comment;
        });
    
        STORE.comments = comments;

        // Update count for home page render
        return STORE.connection.collection(appConstants.EVENTS_TABLE).updateOne({ eventId }, { $set: {commentCount: comments.length} });
    })
    .then(() => {
        res.send({
            success: true,
            comments: STORE.comments,
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.post('/comments/:sessionToken', function(req, res) {
    const { sessionToken } = req.params;
    const { eventId, comment, isCreator } = req.body;
    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        return STORE.connection.collection(appConstants.COMMENTS_TABLE).insertOne({
            commentId: uuidv4(),
            eventId,
            comment,
            userId: objUser.userId,
            isCreator,
            datetimePosted: new Date().toISOString(),
        })
    })
    .then(() => {
        // let event owner know there is a new comment
        // to do: decide if we should notify all previous commenters?? all guest list?
        if(isCreator === true){
            // if it's user's own event dont notify anyone... yet
            return Promise.resolve();
        }

        // Get the event host
        STORE.connection.collection(appConstants.EVENTS_TABLE).find({eventId}).toArray()
        .then((arrEvents) => {
            return pushNotification(STORE.connection, arrEvents[0].userId, 'commented-event', `${STORE.objUser.username} commented on event ${arrEvents[0].title}.`)
        })
        .catch((e) => {
            console.log(e);
            return Promise.resolve();
        })
    })
    .then(() => {
        res.send({
            success: true,
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.delete('/comments/:commentId/:sessionToken', function(req, res) {
    const { sessionToken, commentId } = req.params;
    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        return STORE.connection.collection(appConstants.COMMENTS_TABLE).deleteOne({
            commentId,
            userId: objUser.userId,
        })
    })
    .then(() => {
        res.send({
            success: true,
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

module.exports = router;