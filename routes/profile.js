var express = require('express');
var router = express.Router();

const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');
const PROFILE_TABLE = 'profile';

router.get('/:sessionToken', function(req, res, next) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect()
    .then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        const userId = objUser.userId;
        return STORE.connection.collection(PROFILE_TABLE).find({ userId }).toArray();
    })
    .then((arrProfiles) => {
        let profile = {};
        if(arrProfiles.length === 1){
            profile = arrProfiles[0];
        }
        res.send({
            success: true,
            profile,
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

router.put('/:sessionToken', function(req, res, next) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect()
    .then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        const userId = userObj.userId;
        // req.body should only contain fields getting updated.
        return STORE.connection.collection(PROFILE_TABLE).updateOne({ userId }, {$set: req.body}, {upsert: true});
    })
    .then(() => {
        res.send({
            success: true,
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

module.exports = router;