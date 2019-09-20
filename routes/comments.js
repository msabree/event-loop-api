var express = require('express');
var router = express.Router();
const uuidv4 = require('uuid/v4');

const appConstants = require('../utils/constants');
const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

router.get('/:eventId/:sessionToken', function(req, res) {
    const { sessionToken, eventId } = req.params;
    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((userObj) => {
        STORE.userObj = userObj;
        return STORE.connection.collection(appConstants.COMMENTS_TABLE).find({eventId}).toArray();
    })
    .then((comments) => {
        res.send({
            success: true,
            comments,
        })
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.post('/:sessionToken', function(req, res) {
    const { sessionToken } = req.params;
    const { eventId, comment, isCreator } = req.body;
    const STORE = {};
    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => STORE.connection.collection(appConstants.COMMENTS_TABLE).insertOne({
        commentId: uuidv4(),
        eventId,
        comment,
        userId: objUser.userId,
        isCreator,
        datetimePosted: new Date().toISOString(),
    }))
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