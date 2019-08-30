var express = require('express');
var router = express.Router();

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

// Auto delete after one day past event date?
router.post('/', function(req, res, next) {

    const { sessionToken, title, location, purpose, datetime } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        const userId = objUser.userId;
        return STORE.connection.collection(appConstants.EVENTS_TABLE).insertOne({
            userId,
            title, 
            location,
            purpose,
            startDatetime,
            endDateTime,
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