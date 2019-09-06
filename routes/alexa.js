var express = require('express');
var router = express.Router();

const appConstants = require('../utils/constants');
const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

router.get('/sync-code/:sessionToken', function(req, res) {
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
            syncCode: STORE.syncCode,
        });
    })
    .catch((err) => {
        res.send({
            message: '',
            success: false,
            err,
        });
    })
});

// Alexa endpoint to sync device with app profile
router.post('/sync-profile', function(req, res) {

    const { syncCode } = req.body;

    dbConnect.then((connection) => {
        return connection.collection(appConstants.ALEXA_SYNC_CODES_TABLE).find({ syncCode }).toArray();
    })
    .then((arrCodes) => {
        res.send({
            arrCodes: JSON.stringify(arrCodes),
        });
    })
    .catch((err) => {
        res.send({
            message: 'oops',
            err,
        });
    })
});

module.exports = router;
