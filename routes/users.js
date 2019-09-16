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

const appConstants = require('../utils/constants');
const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

const uploadPhotoToS3 = (updateFields, sessionToken) => {
    return new Promise((resolve, reject) => {
        const base64ProfilePic = get(updateFields, 'profilePic', null);
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

router.get('/:sessionToken', function(req, res) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        const userId = objUser.userId;
        return STORE.connection.collection(appConstants.USERS_TABLE).find({ userId }).toArray();
    })
    .then((arrProfiles) => {
        // EXACT COPY IN PUT
        let profile = {};
        if(arrProfiles.length === 1){
            const {
                username,
                displayName,
                profilePic,
                userId,
                alexaSessionTokenActive,
                notifyFriendRequests,
                notifyJoinLeaveEvents,
                notifyEventChanges,
            } = arrProfiles[0];

            profile = {
                username,
                displayName,
                profilePic,
                userId,
                alexaSessionTokenActive,
                notifyFriendRequests,
                notifyJoinLeaveEvents,
                notifyEventChanges,
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

router.put('/:sessionToken', function(req, res) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then(() => uploadPhotoToS3(req.body, sessionToken))
    .then((update) => STORE.connection.collection(appConstants.USERS_TABLE).updateOne({ sessionToken }, { $set: update }))
    .then(() => STORE.connection.collection(appConstants.USERS_TABLE).find({ sessionToken }).toArray())
    .then((arrProfiles) => {
        // EXACT COPY IN GET
        let profile = {};
        if(arrProfiles.length === 1){
            const {
                username,
                displayName,
                profilePic,
                userId,
                alexaSessionTokenActive,
                notifyFriendRequests,
                notifyJoinLeaveEvents,
                notifyEventChanges,
            } = arrProfiles[0];

            profile = {
                username,
                displayName,
                profilePic,
                userId,
                alexaSessionTokenActive,
                notifyFriendRequests,
                notifyJoinLeaveEvents,
                notifyEventChanges,
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
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.get('/verification/:phoneNumber/:code', function(req, res) {

    const { phoneNumber, code } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return connection.collection(appConstants.USERS_TABLE).find({ phoneNumber }).toArray();
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
                return STORE.connection.collection(appConstants.USERS_TABLE).updateOne({ phoneNumber }, { $set: {sessionToken} });
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
                    alexaSessionToken: '', // We generate this before the user confirms, use with alexaSessionTokenActive flag
                    alexaSessionTokenActive: false,
                    notifyFriendRequests: true,
                    notifyJoinLeaveEvents: true,
                    notifyEventChanges: true,
                }

                return STORE.connection.collection(appConstants.USERS_TABLE).insertOne(objUser);
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

router.post('/verification/:phoneNumber', function(req, res) {

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

router.post('/search/:sessionToken', function(req, res) {

    const { sessionToken } = req.params;
    const { phoneNumbers, usernameQuery } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        const usernameRegex = new RegExp(usernameQuery, 'g');
        return STORE.connection.collection(appConstants.USERS_TABLE).find({ $or: [{ username: usernameRegex }, { phoneNumber: {$in: phoneNumbers} }] }).toArray();
    })
    .then((matches) => {
        // don't send own account back in this response
        // todo: filter any sensitive profile info
        const matchesFiltered = matches.filter((match) => match.userId !== STORE.userObj.userId);
        res.send({
            success: true,
            message: '',
            matches: matchesFiltered,
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            matches: [],
            message: err.message || err
        })  
    })
});

// Used to check if user can change their username to a desired query value
// if taken they cannot use it
router.get('/search/:sessionToken/:query', function(req, res) {

    const { sessionToken, query } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(appConstants.USERS_TABLE).find({ username: query }).toArray();
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

router.post('/app-feedback', function(req, res) {

    const { feedback, sessionToken } = req.body;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        return STORE.connection.collection(appConstants.APP_FEEDBACK_TABLE).insertOne({
            feedback,
            posted: new Date().toISOString(),
            userId: objUser.userId,
        });
    })
    .then(() => {
        res.send({
            success: true,
            message: 'thanks'
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