var express = require('express');
var router = express.Router();
const uuidv4 = require('uuid/v4');

const appConstants = require('../utils/constants');
const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');

router.post('/', function(req, res) {
    
    const { members, title } = req.body;
    const sessionToken = req.get('USER-SESSION-TOKEN');
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        return STORE.connection.collection(appConstants.GROUPS_TABLE).insertOne({
            groupId: uuidv4(),
            members,
            title,
            created: new Date().toISOString(),
            userId: objUser.userId,
        });
    })
    .then(() => {
        res.send({
            success: true,
            message: '',
        })        
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

router.get('/', function(req, res) {
    
    const sessionToken = req.get('USER-SESSION-TOKEN');
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        return STORE.connection.collection(appConstants.GROUPS_TABLE).find({
            userId: objUser.userId,
        }).toArray();
    })
    .then((groups) => {
        res.send({
            groups,
            success: true,
            message: '',
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
