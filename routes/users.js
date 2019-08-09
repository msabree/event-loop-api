var express = require('express');
var router = express.Router();
const uuidv1 = require('uuid/v1');

// TWILIO
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');
const USERS_TABLE = 'users';

router.get('/verification/:phoneNumber/:code', function(req, res, next) {

    const { phoneNumber, code } = req.params;
    const STORE = {};

    dbConnect()
    .then((connection) => {
        STORE.connection = connection;
        return connection.collection(USERS_TABLE).find({ phoneNumber }).toArray();
    })
    .then((arrUsers) => {
        if(arrUsers.length > 1){
            throw new Error('Multiple profiles found');
        }

        STORE.arrUsers = arrUsers;
        
        return client.verify.services(process.env.TWILIO_SERVICE_ID)
        .verificationChecks
        .create({to: phoneNumber, code: code})
    })
    .then((verification_check) => {
        if(verification_check.status === 'approved'){

            const sessionToken = uuidv1(); // this can rotate
            STORE.sessionToken = sessionToken;

            if(STORE.arrUsers.length === 1){
                // account exists, send new generated session token
                return STORE.connection.collection(USERS_TABLE).updateOne({ phoneNumber }, { $set: {sessionToken} });
            }
            else {
                // account does NOT exists, create a new profile and return session
                const objUser = {
                    userId: uuidv1(), // this is a static reference
                    sessionToken,
                    phoneNumber,
                    profilePic: null,
                    joined: new Date().toISOString(),
                    legalName: '', // optional
                    email: '', // optional
                    username: 'user_' + new Date().getTime(), // pregenerated, can be changed later
                    pushObject: {}, // the id for push notifications, this id rotates so we have a route to update it
                }

                return STORE.connection.collection(USERS_TABLE).insertOne(objUser);
            }
        }
        else{
            res.send({
                success: false,
                message: 'Invalid code.'
            })
        }
    })
    .then(() => {
        res.send({
            success: true,
            sessionToken: STORE.sessionToken,
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

router.get('/verification/:phoneNumber', function(req, res, next) {

    const { phoneNumber } = req.params;

    client.verify.services(process.env.TWILIO_SERVICE_ID)
    .verifications
    .create({to: phoneNumber, channel: 'sms'})
    .then((verification) => {
        res.send({
            success: true,
            sid: verification.sid,
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

router.get('/search/:sessionToken/:query', function(req, res, next) {

    const { sessionToken, query } = req.params;
    const STORE = {};

    dbConnect()
    .then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(USERS_TABLE).find({ $or: [{ username: query }, { phoneNumber: query }] }).toArray();
    })
    .then((arrMatchedUsers) => {
        if(arrMatchedUsers.length > 1){
            throw new Error('too many matches'); // query SHOULD exact match only and these props SHOULD be unique
        }
        else if(arrMatchedUsers.length === 0){
            res.send({
                success: false,
                message: 'No matches',
                user: {
                   username: arrMatchedUsers[0].username,
                   phoneNumber: arrMatchedUsers[0].phoneNumber,
                   userId: arrMatchedUsers[0].userId,
                }
            })
        }
        else {
            res.send({
                success: true,
                message: '',
                user: null
            })
        }
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

module.exports = router;