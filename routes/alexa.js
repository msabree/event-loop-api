var express = require('express');
var router = express.Router();

const dbConnect = require('../utils/dbConnect');
const ALEXA_SYNC_CODES_TABLE = 'alexa';

// Generate codes for a user
router.get('/verification-codes', function(_, res) {

    const STORE = {};

    dbConnect.then((connection) => {
        // TODO: GET all sync codes first to ensure uniqueness. Then regenerate is a duplicate is encountered.
        const syncCode = Math.floor(1000 + Math.random() * 9000);
        STORE.syncCode = syncCode;
        return connection.collection(ALEXA_SYNC_CODES_TABLE).insertOne({
            userId: 'userABC',
            syncCode: syncCode.toString(),
        });
    })
    .then(() => {
        res.send({
            syncCode: STORE.syncCode,
        });
    })
    .catch((err) => {
        res.send({
            message: 'oops',
            err,
        });
    })
});

// Alexa endpoint to sync device with app profile
router.post('/sync-profile', function(req, res) {

    const { syncCode } = req.body;

    dbConnect.then((connection) => {
        console.log(syncCode)
        return connection.collection(ALEXA_SYNC_CODES_TABLE).find({ syncCode }).toArray();
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
