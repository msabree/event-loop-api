var express = require('express');
var router = express.Router();
const uuidv4 = require('uuid/v4');
const get = require('lodash/get');

const appConstants = require('../utils/constants');
const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

// Check pairing
router.get('/sync-code/:sessionToken', function(req, res) {

    const { sessionToken } = req.params;

    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        const alexaSessionToken = get(objUser, 'alexaSessionToken', '');
        const alexaSessionTokenActive = get(objUser, 'alexaSessionTokenActive', false);

        if(alexaSessionToken === null && alexaSessionTokenActive === false){
            res.send({
                success: true,
                paired: false,
                message: 'No pairing requests found.',
            });
        }
        else{
            res.send({
                success: true,
                paired: true,
                message: 'Pairing request found.',
            });
        }
    })
    .catch((err) => {
        res.send({
            message: 'Something went wrong. Please try again later.',
            paired: false,
            success: false,
            err,
        });
    })
});

// Initiate pairing
router.post('/sync-code/:sessionToken', function(req, res) {
    const { sessionToken } = req.params;

    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        // DELETE ANY PRE-EXISTING CODES FROM THE DATABASE TO PREVENT CLASHES
        return STORE.connection.collection(appConstants.ALEXA_SYNC_CODES_TABLE).deleteMany({
            userId: objUser.userId,
        });
    })
    .then(() => {
        const syncCode = Math.floor(1000 + Math.random() * 9000);
        STORE.syncCode = syncCode;
        return STORE.connection.collection(appConstants.ALEXA_SYNC_CODES_TABLE).insertOne({
            userId: STORE.objUser.userId,
            syncCode: syncCode.toString(),
            createdDatetime: new Date().toISOString(),
        });        
    })
    .then(() => {
        res.send({
            success: true,
            syncCode: STORE.syncCode.toString(),
        });
    })
    .catch((err) => {
        res.send({
            message: 'Unable to generate sync code. Please try again later.',
            success: false,
            err,
        });
    })
});

// Confirm pairing (request come from Alexa)
router.put('/sync-code', function(req, res) {

    const { syncCode } = req.body;

    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return connection.collection(appConstants.ALEXA_SYNC_CODES_TABLE).find({ syncCode }).toArray();
    })
    .then((arrCodes) => {
        if(arrCodes.length !== 1){
            res.send({
                success: false,
                alexaSessionToken: '',
                speak: 'We were unable to locate this sync code. Please ensure that you have the associated app open. If the app is open please close and reopen the sync page to generate a new code.',
            });
        }
        else{
            const alexaSessionToken = uuidv4();
            STORE.connection.collection(appConstants.USERS_TABLE).updateOne({ userId: arrCodes[0].userId }, { $set: {alexaSessionToken} })
            .then(() => {
                res.send({
                    success: true,
                    alexaSessionToken, // be sure to give it to alexa device to persist in S3 or dynamo (no expiration at the moment)
                    speak: 'Found matching sync request. Please confirm the connection on your device. Once confirmed the connection will be complete.',
                }); 
            })
        }
    })
    .catch((err) => {
        res.send({
            speak: 'Something went wrong in the pairing process. Please try again later.',
            err,
        });
    })
});

// Delete sync and mark alexa session active
router.delete('/sync-code/:sessionToken', function(req, res) {

    const { sessionToken } = req.params;

    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        // DELETE ANY PRE-EXISTING CODES FROM THE DATABASE TO PREVENT CLASHES
        return STORE.connection.collection(appConstants.ALEXA_SYNC_CODES_TABLE).deleteMany({
            userId: objUser.userId,
        });
    })
    .then(() => {
        return STORE.connection.collection(appConstants.USERS_TABLE).updateOne({ userId: STORE.objUser.userId }, { $set: {alexaSessionTokenActive: true} })
    })
    .then(() => {
        res.send({
            success: true,
        });
    })
    .catch((err) => {
        res.send({
            success: false,
            message: 'Something went wrong. Please try again later.',
            err,
        });
    })
});

// Called from Alexa to see if session is still active?
router.get('/connection/:sessionToken', function(req, res) {
    const { sessionToken } = req.params;

    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then(() => {
        res.send({
            success: true,
        });
    })
    .catch(() => {
        res.send({
            success: false,
        });
    })
});

router.delete('/connection/:sessionToken', function(req, res) {

    const { sessionToken } = req.params;

    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        STORE.objUser = objUser;
        // DELETE ANY PRE-EXISTING CODES FROM THE DATABASE TO PREVENT CLASHES
        return STORE.connection.collection(appConstants.ALEXA_SYNC_CODES_TABLE).deleteMany({
            userId: objUser.userId,
        });
    })
    .then(() => {
        return STORE.connection.collection(appConstants.USERS_TABLE).updateOne({ userId: STORE.objUser.userId }, { $set: {alexaSessionToken: null, alexaSessionTokenActive: false} })
    })
    .then(() => {
        res.send({
            success: true,
        });
    })
    .catch((err) => {
        res.send({
            success: false,
            message: 'Something went wrong. Please try again later.',
            err,
        });
    })
});

module.exports = router;
