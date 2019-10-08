var express = require('express');
var router = express.Router();
const uuidv4 = require('uuid/v4');
const findIndex = require('lodash/findIndex');

const appConstants = require('../utils/constants');
const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');
const pushNotification = require('../utils/pushNotification');

router.get('/:sessionToken', function(req, res) {
    const { sessionToken } = req.params;
    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(appConstants.FRIENDS_REQUESTS_TABLE).find({userId: userObj.userId}).toArray();
    })
    .then((arrRequests) => {
        STORE.arrRequests = arrRequests;
        return STORE.connection.collection(appConstants.FRIENDS_TABLE).find({userId: STORE.userObj.userId}).toArray();
    })
    .then((arrFriends) => {
        STORE.arrFriends = arrFriends;
        return STORE.connection.collection(appConstants.FRIENDS_REQUESTS_TABLE).find({requestorUserId: STORE.userObj.userId}).toArray();
    })
    .then((arrSentRequests) => {
        STORE.arrSentRequests = arrSentRequests;
        const userIds = [];
        for(let i = 0; i < STORE.arrRequests.length; i++){
            userIds.push(STORE.arrRequests[i].requestorUserId);
        }

        for(let i = 0; i < STORE.arrFriends.length; i++){
            userIds.push(STORE.arrFriends[i].friendUserId);
        }

        for(let i = 0; i < STORE.arrSentRequests.length; i++){
            userIds.push(STORE.arrSentRequests[i].userId);
        }

        // todo: sent invites to app

        return STORE.connection.collection(appConstants.USERS_TABLE).find({userId: {$in: userIds}}).toArray();
    })
    .then((arrProfiles) => {
        const profileMap = {};
        for(let i = 0; i < arrProfiles.length; i++){
            profileMap[arrProfiles[i].userId] = {
                profilePic: arrProfiles[i].profilePic,
                username: arrProfiles[i].username,
                phoneNumber: arrProfiles[i].phoneNumber,
                displayName: arrProfiles[i].displayName,
            }
        }

        const friends = STORE.arrFriends.map((friend) => {
            friend._profilePic = profileMap[friend.friendUserId].profilePic;
            friend._username = profileMap[friend.friendUserId].username;
            friend._displayName = profileMap[friend.friendUserId].displayName;
            return friend;
        })

        const requests = STORE.arrRequests.map((request) => {
            request._profilePic = profileMap[request.requestorUserId].profilePic;
            request._username = profileMap[request.requestorUserId].username;
            request._displayName = profileMap[request.requestorUserId].displayName;
            return request;
        })

        const sentRequests = STORE.arrSentRequests.map((sentRequest) => {
            sentRequest._profilePic = profileMap[sentRequest.userId].profilePic;
            sentRequest._username = profileMap[sentRequest.userId].username;
            sentRequest._displayName = profileMap[sentRequest.userId].displayName;
            return sentRequest;
        })

        res.send({
            success: true,
            requests,
            friends,
            sentRequests,
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.put('/:sessionToken', function(req, res) {
    
    const { sessionToken } = req.params;
    const { starred = true, friendUserId } = req.body;
    const STORE = {};
    
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        return STORE.connection.collection(appConstants.FRIENDS_TABLE).updateOne({ userId: userObj.userId, friendUserId }, { $set: {starred} })
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

router.post('/request', function(req, res) {

    const { sessionToken, friendUserId } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(appConstants.FRIENDS_TABLE).find({userId: userObj.userId}).toArray();
    })
    .then((arrFriends) => {
        const foundIndex = findIndex(arrFriends, (friend) => {return friend.friendUserId === friendUserId});
        if(foundIndex === -1){
            // not a friend yet... check for pending requests...
            // also, check if the other user already sent this user a request
            // if a each user sends a friend request and both accept we'd have an edge case were a friend is listed twice
            return STORE.connection.collection(appConstants.FRIENDS_REQUESTS_TABLE).find({ $or: [{requestorUserId: STORE.userObj.userId}, {userId: STORE.userObj.userId}] }).toArray();
        }
        else{
            throw new Error('friends');
        }
    })
    .then((arrRequests) => {
        const foundIndex = findIndex(arrRequests, (request) => {
            return (request.requestorUserId === STORE.userObj.userId && request.userId === friendUserId || 
                request.userId === STORE.userObj.userId && request.requestorUserId === friendUserId);
        });
        if(foundIndex === -1){
            const requestId = uuidv4();
            STORE.requestId = requestId;
    
            const friendRequestObj = {
                userId: friendUserId, // owner of account is the friend you want to ask for access 
                requestId,
                requestorUserId: STORE.userObj.userId, // current user is the requestor
                dateRequested: new Date().toISOString(),
            }
            return STORE.connection.collection(appConstants.FRIENDS_REQUESTS_TABLE).insertOne(friendRequestObj);
        }
        else{
            throw new Error('requested')
        }
    })
    .then(() => {
        // Notify the friend of a new request
        return pushNotification(STORE.connection, friendUserId, 'friend-request', `${STORE.userObj.username} sent you a friend request.`);
    })
    .then(() => {
        res.send({
            success: true,
            message: 'ok',
        })
    })
    .catch((err) => {
        console.log(err);
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.post('/request-response', function(req, res) {
    
    const { sessionToken, requestId, isConfirmed } = req.body;
    const STORE = {};
    
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(appConstants.FRIENDS_REQUESTS_TABLE).find({ requestId }).toArray();
    })
    .then((arrRequests) => {
        if(arrRequests.length !== 1){
            throw new Error('Too many matches for friend request id')
        }
        else{
            STORE.request = arrRequests[0];
            if(isConfirmed === true){
                // add a friend object for both users
                const friendObjs = [
                    {
                        userId: STORE.userObj.userId,
                        friendUserId: STORE.request.requestorUserId,
                        starred: false,
                        dateAdded: new Date().toISOString(),
                    },
                    {
                        userId: STORE.request.requestorUserId,
                        friendUserId: STORE.userObj.userId,
                        starred: false,
                        dateAdded: new Date().toISOString(),
                    }
                ]
                return STORE.connection.collection(appConstants.FRIENDS_TABLE).insertMany(friendObjs);
            }
            else{
                return Promise.resolve();
            }
        }
    })
    .then(() => {
        return STORE.connection.collection(appConstants.FRIENDS_REQUESTS_TABLE).deleteOne({requestId});
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

router.delete('/:sessionToken/:friendUserId', function(req, res) {
    const { sessionToken, friendUserId } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        // delete both objects to ensure removed from both user's perspectives
        return Promise.all([
            STORE.connection.collection(appConstants.FRIENDS_TABLE).deleteOne({userId: objUser.userId, friendUserId}),
            STORE.connection.collection(appConstants.FRIENDS_TABLE).deleteOne({userId: friendUserId, friendUserId: objUser.userId}),
        ])
    })
    .then(() => {
        res.send({
            success: true,
            message: 'ok'
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
