var express = require('express');
var router = express.Router();
const uuidv4 = require('uuid/v4');
const findIndex = require('lodash/findIndex');

const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

const FRIENDS_REQUESTS_TABLE = 'friend-requests';
const FRIENDS_TABLE = 'friends';
const USERS_TABLE = 'users';

router.get('/:sessionToken', function(req, res, next) {
    const { sessionToken } = req.params;
    const STORE = {};
    dbConnect.then((connection) => {
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
        const arrRequestorUserIds = STORE.arrRequests.map((request) => {
            return request.requestorUserId;
        })
        return STORE.connection.collection(USERS_TABLE).find({userId: {$in: arrRequestorUserIds}}).toArray();
    })
    .then((arrRequestsProfiles) => {
        const friendsMap = {};
        for(let i = 0; i < STORE.arrFriendsProfiles.length; i++){
            friendsMap[STORE.arrFriendsProfiles[i].userId] = {
                profilePic: STORE.arrFriendsProfiles[i].profilePic,
                username: STORE.arrFriendsProfiles[i].username,
                phoneNumber: STORE.arrFriendsProfiles[i].phoneNumber,
                displayName: STORE.arrFriendsProfiles[i].displayName,
            }
        }

        const requestsMap = {};
        for(let i = 0; i < arrRequestsProfiles.length; i++){
            requestsMap[arrRequestsProfiles[i].userId] = {
                profilePic: arrRequestsProfiles[i].profilePic,
                username: arrRequestsProfiles[i].username,
                phoneNumber: arrRequestsProfiles[i].phoneNumber,
                displayName: arrRequestsProfiles[i].displayName,
            }
        }

        const friends = STORE.arrFriends.map((friend) => {
            friend._profilePic = friendsMap[friend.friendUserId].profilePic;
            friend._username = friendsMap[friend.friendUserId].username;
            friend._displayName = friendsMap[friend.friendUserId].displayName;
            return friend;
        })

        const requests = STORE.arrRequests.map((request) => {
            request._profilePic = requestsMap[request.requestorUserId].profilePic;
            request._username = requestsMap[request.requestorUserId].username;
            request._displayName = requestsMap[request.requestorUserId].displayName;
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

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(FRIENDS_TABLE).find({userId: userObj.userId}).toArray();
    })
    .then((arrFriends) => {
        const foundIndex = findIndex(arrFriends, (friend) => {return friend.friendUserId === friendUserId});
        console.log(foundIndex, arrFriends, friendUserId)
        if(foundIndex === -1){
            // not a friend yet... check for pending requests...
            return STORE.connection.collection(FRIENDS_REQUESTS_TABLE).find({userId: STORE.userObj.userId}).toArray();
        }
        else{
            throw new Error('friends');
        }
    })
    .then((arrRequests) => {
        const foundIndex = findIndex(arrRequests, (request) => {return request.requestorUserId === STORE.userObj.userId});
        console.log(foundIndex, arrRequests, STORE.userObj.userId)
        if(foundIndex === -1){
            const requestId = uuidv4();
            STORE.requestId = requestId;
    
            const friendRequestObj = {
                userId: friendUserId, // owner of account is the friend you want to ask for access 
                requestId,
                requestorUserId: STORE.userObj.userId, // current user is the requestor
                dateRequested: new Date().toISOString(),
            }
            return STORE.connection.collection(FRIENDS_REQUESTS_TABLE).insertOne(friendRequestObj);
        }
        else{
            throw new Error('requested')
        }
    })
    .then(() => {
        res.send({
            success: true,
            message: 'ok',
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
    
    dbConnect.then((connection) => {
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
                    friendUserId: STORE.request.requestorUserId,
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
        return STORE.connection.collection(FRIENDS_REQUESTS_TABLE).deleteOne({requestId});
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

router.delete('/:sessionToken/:friendUserId', function(req, res, next) {
    const { sessionToken, friendUserId } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        return STORE.connection.collection(FRIENDS_TABLE).remove({userId: objUser.userId, friendUserId});
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
