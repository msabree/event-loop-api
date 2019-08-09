var express = require('express');
var router = express.Router();
const uuidv1 = require('uuid/v1');

const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

const FRIENDS_TABLE = 'friends';

router.get('/:sessionToken', function(req, res, next) {
    dbConnect()
    .then((connection) => {
        
    })
    .catch(() => {

    })
});

router.post('/request', function(req, res, next) {

    const { sessionToken, userId } = req.body;
    const STORE = {};

    dbConnect()
    .then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        const requestId = uuidv1();
        STORE.requestId = requestId;

        const friendObj = {
            requestId,
            userId,
            dateRequested: new Date().toISOString(),
            status: 'request',
            dateConfirmed: null,
        }
        return STORE.connection.collection(FRIENDS_TABLE).update({ userId: userObj.userId }, { $push: { friends: {friendObj} } })
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
        return STORE.connection.collection(FRIENDS_TABLE).find({ userId: userObj.userId }).toArray();
    })
    .catch((arrUserFriends) => {
        if(arrUserFriends.length !== 1){
            throw new Error('too many matches in friends table')
        }
        else{
            const friends = arrUserFriends[0].friends;
            let removeIndex = -1;
            for(let i = 0; i < friends.length; i++){
                if(friends[i].requestId === requestId){
                    if(isConfirmed){
                        friends[i].status = 'confirmed';
                        friends[i].dateConfirmed = new Date().toISOString();
                    }
                    else{
                        removeIndex = i;
                    }

                    break;
                } 
            }

            if(removeIndex !== -1){
                friends.splice(removeIndex, 1);
            }
        }

        return STORE.connection.collection(FRIENDS_TABLE).update({ userId: userObj.userId }, { $set: { friends } })
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
