var express = require('express');
var router = express.Router();

const dbConnect = require('../utils/dbConnect');
const getSession = require('../utils/getSession');
const PROFILE_TABLE = 'profile';
const FRIENDS_TABLE = 'friends';
const USERS_TABLE = 'users';

router.get('/:sessionToken', function(req, res, next) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
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
            const {
                location,
                status,
            } = arrProfiles[0];

            profile = {
                location,
                status,
            }
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

router.get('/friends/:sessionToken', function(req, res, next) {

    const { sessionToken } = req.params;
    const STORE = {};

    dbConnect.then((connection) => {
        STORE.connection = connection;
        return getSession(sessionToken, connection);
    })
    .then((objUser) => {
        const userId = objUser.userId;
        return STORE.connection.collection(FRIENDS_TABLE).find({ userId }).toArray();
    })
    .then((arrFriends) => {
        const arrFriendsUserIds = arrFriends.map((friend) => {
            return friend.friendUserId;
        })

        STORE.arrFriendsUserIds = arrFriendsUserIds;

        return STORE.connection.collection(PROFILE_TABLE).find({userId: {$in: arrFriendsUserIds}}).toArray();
    })
    .then((arrFriendsProfiles) => {
        STORE.arrFriendsProfiles = arrFriendsProfiles;
        return STORE.connection.collection(USERS_TABLE).find({userId: {$in: STORE.arrFriendsUserIds}}).toArray();
    })
    .then((arrFriendsUserObjs) => {

        const friendsUsersObjsMap = {};
        for(let i = 0; i < arrFriendsUserObjs.length; i++){
            friendsUsersObjsMap[arrFriendsUserObjs[i].userId] = {
                profilePic: arrFriendsUserObjs[i].profilePic,
                username: arrFriendsUserObjs[i].username,
                legalName: arrFriendsUserObjs[i].legalName,
            }
        }

        const arrFilteredProfiles = STORE.arrFriendsProfiles.map((profile) => {
            return {
                profilePic: friendsUsersObjsMap[profile.userId].profilePic,
                username: friendsUsersObjsMap[profile.userId].username,
                legalName: friendsUsersObjsMap[profile.userId].legalName,
                location: profile.location,
                status: profile.status,
            }
        })

        res.send({
            success: true,
            profiles: arrFilteredProfiles,
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

    dbConnect.then((connection) => {
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