var express = require('express');
var router = express.Router();

const appConstants = require('../utils/constants');
const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

router.get('/:sessionToken', function(req, res) {
    const { sessionToken } = req.params;
    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(appConstants.NOTIFICATIONS_TABLE).find({userId: userObj.userId}).toArray();
    })
    .then((notifications) => {
        res.send({
            success: true,
            notifications,
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

// Mark as read
router.put('/:sessionToken', function(req, res) {
    const { sessionToken } = req.params;
    const { notifcationIds } = req.body;
    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => STORE.connection.collection(appConstants.NOTIFICATIONS_TABLE).updateMany({ _id: {$in: notifcationIds}, userId: objUser.userId }, { $set: {read: true} }))
    .then(() => {
        res.send({
            success: true,
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