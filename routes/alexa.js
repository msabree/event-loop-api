var express = require('express');
var router = express.Router();

const dbConnect = require('../utils/dbConnect');
const ALEXA_SYNC_CODES_TABLE = 'alexa';

// Generate codes for a user
router.get('/verification-codes', function(req, res, next) {

    const STORE = {};

    dbConnect()
    .then((connection) => {
        // TODO: GET all sync codes first to ensure uniqueness. Then regenerate is a duplicate is encountered.
        const syncCode = Math.floor(1000 + Math.random() * 9000);
        STORE.syncCode = syncCode;
        return connection.collection(ALEXA_SYNC_CODES_TABLE).insertOne({
            userId: 'userABC',
            syncCode,
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
router.post('/sync-profile', function(req, res, next) {

    const { syncCode } = req.body;

    dbConnect()
    .then((connection) => {
        
        console.log(syncCode)

        // once we have alexa sending codes we'd need to find the user's profile who initiated the sync

        res.send({
            message: 'ok'
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
