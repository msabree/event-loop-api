var express = require('express');
var router = express.Router();
const uuidv1 = require('uuid/v1');
const get = require('lodash/get');

const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

const FRIENDS_REQUESTS_TABLE = 'friend-requests';
const FRIENDS_TABLE = 'friends';
const USERS_TABLE = 'users';

router.get('/:sessionToken', function(req, res, next) {
    const { sessionToken } = req.params;
    const STORE = {};
    dbConnect()
    .then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(FRIENDS_REQUESTS_TABLE).find({userId: userObj.userId}).toArray();
    })
    .then((arrRequests) => {
        STORE.arrRequests = arrRequests;
        return STORE.connection.collection(FRIENDS_TABLE).find({userId: STORE.userObj.userId}).toArray();
    })
    .then((arrFriends) => {
        STORE.arrFriends = arrFriends;
        const arrFriendsUserIds = arrFriends.map((friend) => {
            return friend.friendUserId;
        })
        return STORE.connection.collection(USERS_TABLE).find({userId: {$in: arrFriendsUserIds}}).toArray();
    })
    .then((arrFriendsProfiles) => {
        STORE.arrFriendsProfiles = arrFriendsProfiles;
        const arrRequestsUserIds = STORE.arrRequests.map((request) => {
            return request.friendUserId;
        })
        return STORE.connection.collection(USERS_TABLE).find({userId: {$in: arrRequestsUserIds}}).toArray();
    })
    .then((arrRequestsProfiles) => {
        console.log(arrRequestsProfiles);
        console.log(JSON.stringify(STORE));
        const friendsMap = {};
        for(let i = 0; i < STORE.arrFriendsProfiles.length; i++){
            friendsMap[STORE.arrFriendsProfiles[i].friendUserId] = {
                profilePic: STORE.arrFriendsProfiles[i].profilePic,
            }
        }

        const requestsMap = {};
        for(let i = 0; i < arrRequestsProfiles.length; i++){
            requestsMap[arrRequestsProfiles[i].friendUserId] = {
                profilePic: arrRequestsProfiles[i].profilePic,
            }
        }

        const friends = STORE.arrFriends.map((friend) => {
            friend._profilePic = friendsMap[friend.friendUserId].profilePic;
            return friend;
        })

        const requests = STORE.arrRequests.map((request) => {
            request._profilePic = requestsMap[request.friendUserId].profilePic;
            return request;
        })

        res.send({
            success: true,
            requests,
            friends,
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.post('/request', function(req, res, next) {

    const { sessionToken, friendUserId } = req.body;
    const STORE = {};

    dbConnect()
    .then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        const requestId = uuidv1();
        STORE.requestId = requestId;

        const friendRequestObj = {
            userId: userObj.userId,
            requestId,
            friendUserId,
            dateRequested: new Date().toISOString(),
        }
        return STORE.connection.collection(FRIENDS_REQUESTS_TABLE).insert(friendRequestObj);
    })
    .then(() => {
        res.send({
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

router.post('/request-response', function(req, res, next) {
    
    const { sessionToken, requestId, isConfirmed } = req.body;
    const STORE = {};
    
    dbConnect()
    .then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(FRIENDS_REQUESTS_TABLE).find({ requestId }).toArray();
    })
    .then((arrRequests) => {
        if(arrRequests.length !== 1){
            throw new Error('Too many matches for friend request id')
        }
        else{
            STORE.request = arrRequests[0];
            if(isConfirmed === true){
                const friendObj = {
                    userId: STORE.userObj.userId,
                    friendUserId: STORE.request.friendUserId,
                    dateAdded: new Date().toISOString(),
                }
                return STORE.connection.collection(FRIENDS_TABLE).insert(friendObj);
            }
            else{
                return Promise.resolve();
            }
        }
    })
    .then(() => {
        return STORE.connection.collection(FRIENDS_REQUESTS_TABLE).remove({requestId});
    })
    .then(() => {
        res.send({
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

router.delete('/:sessionToken/:userId', function(req, res, next) {
    const { sessionToken, userId } = req.params;
    const STORE = {};

    dbConnect()
    .then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        return STORE.connection.collection(FRIENDS_TABLE).remove({userId: objUser.userId, friendUserId: userId});
    })
    .then(() => {
        res.send({
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
