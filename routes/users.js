var express = require('express');
var router = express.Router();
const get = require('lodash/get');
const uuidv4 = require('uuid/v4');
const S3 = require('aws-sdk/clients/s3');

// AWS S3
const s3Bucket = new S3({ params: { Bucket: 'flaker-images' } });

// TWILIO
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');
const USERS_TABLE = 'users';

const uploadPhotoToS3 = (updateFields, sessionToken) => {
    return new Promise((resolve, reject) => {
        const base64ProfilePic = get(updateFields, 'profilePic', null);
        console.log('UPLOAD TO S3')
        console.log(base64ProfilePic)
        if (base64ProfilePic !== null) {
            const buf = new Buffer(base64ProfilePic.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const base64Photo = {
                Key: sessionToken,
                Body: buf,
                ContentEncoding: 'base64',
                ContentType: 'image/jpeg',
            };
            s3Bucket.putObject(base64Photo, (err) => {
                if (err) {
                    reject(err);
                } else {
                    updateFields.profilePic = `https://s3.amazonaws.com/flaker-images/${sessionToken}?timestamp=${new Date().getTime()}`;
                    resolve(updateFields);
                }
            });
        } else {
            resolve(updateFields);
        }
    });
}

router.get('/:sessionToken', function(req, res, next) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        const userId = objUser.userId;
        return STORE.connection.collection(USERS_TABLE).find({ userId }).toArray();
    })
    .then((arrProfiles) => {
        // EXACT COPY IN PUT
        let profile = {};
        if(arrProfiles.length === 1){
            const {
                username,
                displayName,
                profilePic,
            } = arrProfiles[0];

            profile = {
                username,
                displayName,
                profilePic
            }
        }
        res.send({
            success: true,
            profile,
            message: ''
        })
        // EXACT COPY IN PUT
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.put('/:sessionToken', function(req, res, next) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then(() => uploadPhotoToS3(req.body, sessionToken))
    .then((update) => STORE.connection.collection(USERS_TABLE).updateOne({ sessionToken }, { $set: update }))
    .then(() => STORE.connection.collection(USERS_TABLE).find({ sessionToken }).toArray())
    .then((arrProfiles) => {
        // EXACT COPY IN GET
        let profile = {};
        if(arrProfiles.length === 1){
            const {
                username,
                displayName,
                profilePic,
            } = arrProfiles[0];

            profile = {
                username,
                displayName,
                profilePic
            }
        }
        res.send({
            success: true,
            profile,
            message: ''
        })
        // EXACT COPY IN GET
    })
    .catch((err) => {
        console.log(err);
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.get('/verification/:phoneNumber/:code', function(req, res, next) {

    const { phoneNumber, code } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
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

            const sessionToken = uuidv4(); // this can rotate
            STORE.sessionToken = sessionToken;

            if(STORE.arrUsers.length === 1){
                // account exists, send new generated session token
                return STORE.connection.collection(USERS_TABLE).updateOne({ phoneNumber }, { $set: {sessionToken} });
            }
            else {
                // account does NOT exists, create a new profile and return session
                const objUser = {
                    userId: uuidv4(), // this is a static reference
                    sessionToken,
                    phoneNumber,
                    profilePic: 'https://flaker-images.s3.amazonaws.com/default-profile.png',
                    joined: new Date().toISOString(),
                    displayName: '', // optional
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

    dbConnect.then((connection) => {
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
                user: null
            })
        }
        else {
            res.send({
                success: true,
                message: '',
                user: {
                    username: arrMatchedUsers[0].username,
                    phoneNumber: arrMatchedUsers[0].phoneNumber,
                    userId: arrMatchedUsers[0].userId,
                }
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