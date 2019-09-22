const admin = require('firebase-admin');
const uuidv4 = require('uuid/v4');
const appConstants = require('./constants');
const get = require('lodash/get');

console.log(typeof process.env.SERVICE_ACCOUNT_JSON)

// Push notifications configuration for Android
admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT_JSON)),
    databaseURL: 'https://flaker-8a057.firebaseio.com',
});

/**
 * Helper to send push notifications and update notifications collection.
 * @param {String} userId - The user who should receive the push notification.
 * @param {String} type - friend-request|join-event|left-event|changed-event|new-event(TO DO)
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
            const androidPush = {
                notification: {
                    title: 'Event Loop Notification',
                    body: `${message}`,
                },
                data: {
                    datetime: new Date().toISOString()
                },
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

            console.log(androidPush)

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