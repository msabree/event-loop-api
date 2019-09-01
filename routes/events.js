var express = require('express');
var router = express.Router();
const uuidv4 = require('uuid/v4');

const appConstants = require('../utils/constants');
const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');
const getFriendsProfiles = require('../utils/getFriendsProfiles');

// Events posted by users or by friends
router.get('/:sessionToken', function(req, res, next) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        const userId = objUser.userId;
        return getFriendsProfiles(STORE.connection, userId);
    })
    .then((friendsProfileMap) => {
        STORE.friendsProfileMap = friendsProfileMap;
        const arrFriendsUserIds = Object.keys(friendsProfileMap);
        arrFriendsUserIds.push(STORE.objUser.userId); // get current user's events as well

        return STORE.connection.collection(appConstants.EVENTS_TABLE).find({userId: {$in: arrFriendsUserIds}}).toArray();
    })
    .then((arrEvents) => {
        STORE.arrEvents = arrEvents;

        // Get all guest lists per event
        const arrEventIds = arrEvents.map((event) => {
            return event.eventId;
        })

        return STORE.connection.collection(appConstants.GUEST_LIST_TABLE).find({eventId: {$in: arrEventIds}}).toArray();
    })
    .then((arrEventsGuestList) => {

        const eventGuestListMap = {};
        for(let i = 0; i < arrEventsGuestList.length; i++){
            let arrGuestList = eventGuestListMap[arrEventsGuestList[i].eventId];
            if(arrGuestList === undefined){
                arrGuestList = [arrEventsGuestList[i].userId];
            }
            else{
                arrGuestList.push(arrEventsGuestList[i].userId);
            }
            eventGuestListMap[arrEventsGuestList[i].eventId] = arrGuestList;
        }


        const formattedEvents = STORE.arrEvents.map((event) => {
            if(event.userId === STORE.objUser.userId){
                // current user created the event
                event.associatedUserProfile = STORE.objUser;
            }
            else {
                event.associatedUserProfile = STORE.friendsProfileMap[event.userId];
            }

            event.guestList = eventGuestListMap[event.eventId];
            return event;
        })
        res.send({
            success: true,
            message: '',
            events: formattedEvents,
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.get('/guest-list/:eventId/:sessionToken', function(req, res, next) {

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
        const profileMap = {};
        for(let i = 0; i < arrProfiles.length; i++){
            // DELETE ANY INFO FROM PROFILE THAT SHOULD NOT GET RETURNED TO CLIENT
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

router.post('/guest-list', function(req, res, next) {

    const { sessionToken, eventId } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        const userId = objUser.userId;
        return STORE.connection.collection(appConstants.GUEST_LIST_TABLE).insertOne({
            eventId,
            userId, 
            confirmedDatetime: new Date().toISOString(),
        });
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

router.delete('/guest-list', function(req, res, next) {

    const { sessionToken, eventId } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        const userId = objUser.userId;
        return STORE.connection.collection(appConstants.GUEST_LIST_TABLE).deleteOne({
            eventId,
            userId,
        });
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

router.post('/', function(req, res, next) {

    const { sessionToken, title, location, details, startDatetime, endDatetime } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        const userId = objUser.userId;
        return STORE.connection.collection(appConstants.EVENTS_TABLE).insertOne({
            eventId: uuidv4(),
            userId,
            title, 
            location,
            details,
            startDatetime: new Date(startDatetime).toISOString(),
            endDatetime: new Date(endDatetime).toISOString(),
            dateCreated: new Date().toISOString(),
        });
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

module.exports = router;