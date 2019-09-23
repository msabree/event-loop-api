const admin = require('firebase-admin');
const apn = require('apn');
const uuidv4 = require('uuid/v4');
const appConstants = require('./constants');
const get = require('lodash/get');

// Push notifications configuration for Android
admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT_JSON)),
    databaseURL: 'https://flaker-8a057.firebaseio.com',
});

// Push notifications configuration for iOS
const options = {
    token: {
        key: process.env.APN_PRIVATE_KEY,
        keyId: '4F5DFZ32Q9',
        teamId: '8F2ZLDNB8X',
    },
    production: true,
};

const apnProvider = new apn.Provider(options);

/**
 * Helper to send push notifications and update notifications collection.
 * @param {String} userId - The user who should receive the push notification.
 * @param {String} type - friend-request|join-event|left-event|changed-event|event-comment
 * @param {Object} connection - Open connection to the data store.
 * @param {Object} message - The notification message to send.
*/
module.exports = function(connection, userId, type, message){
    return new Promise((resolve) => {
        const STORE = {};
        connection.collection(appConstants.USERS_TABLE).find({userId}).toArray()
        .then((arrUsers) => {
            if(arrUsers.length !== 1){
                throw new Error('single user not found')
            }
            else{
                STORE.userObj = arrUsers[0];
            }

            return connection.collection(appConstants.NOTIFICATIONS_TABLE).insertOne({
                notificationId: uuidv4(),
                userId,
                type,
                message,
                createdDatetime: new Date().toISOString(),
                read: false,
            })
        })
        .then(() => {

            // CHECK NOTIFICATION LEVEL TOGGLES
            const notifyFriendRequests = STORE.userObj.notifyFriendRequests;
            const notifyHostEventChanges = STORE.userObj.notifyHostEventChanges;
            const notifyJoinedEventChanges = STORE.userObj.notifyJoinedEventChanges;

            if((notifyFriendRequests === false && type === 'friend-request') || 
            (notifyHostEventChanges === false && (type === 'join-event') || (type === 'left-event')) ||
            (notifyJoinedEventChanges === false && type === 'changed-event')){
                resolve();
                return;
            }

            const androidPush = {
                notification: {
                    title: 'Event Loop Notification',
                    body: `${message}`,
                },
                data: {
                    datetime: new Date().toISOString()
                },
            };

            const iOSPush = new apn.Notification();
            iOSPush.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
            iOSPush.badge = 1;
            iOSPush.sound = 'chime.caf';
            iOSPush.alert = `${message}`;
            iOSPush.topic = 'org.reactjs.native.example.flaker';
            iOSPush.payload = {
                datetime: new Date().toISOString()
            };

            if (get(STORE.userObj, 'pushObject.os', '').toLowerCase() === 'android') {
                admin.messaging().sendToDevice(get(STORE.userObj, 'pushObject.token', ''), androidPush)
                .then(() => {
                    resolve();
                })
                .catch((e) => {
                    throw new Error(e);
                })
            }
            else{
                apnProvider.send(iOSPush, get(STORE.userObj, 'pushObject.token', ''))
                .then(() => {
                    resolve();
                })
                .catch((e) => {
                    throw new Error(e);
                })
            }

            resolve();
        })
        .catch((err) => {
            // "Okay" if this fails... Let's not fail the request.
            // We will just fail to send a push notification.
            console.log(err);
            resolve();
        })
    })
}