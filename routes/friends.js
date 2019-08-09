var express = require('express');
var router = express.Router();
const uuidv1 = require('uuid/v1');

const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

const FRIENDS_REQUESTS_TABLE = 'friend-requests';
const FRIENDS_TABLE = 'friends';

router.get('/:sessionToken', function(req, res, next) {
    dbConnect()
    .then((connection) => {
        
    })
    .catch(() => {

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
    dbConnect()
    .then((connection) => {
        
    })
    .catch(() => {

    })
});

module.exports = router;
