const uuidv4 = require('uuid/v4');
const appConstants = require('./constants');

/**
 * Helper to send push notifications and update notifications collection.
 * @param {String} userId - The user who should receive the push notification.
 * @param {String} type - friend-request|join-event|left-event|changed-event|new-event(TO DO)
 * @param {Object} connection - Open connection to the data store.
 * @param {Object} message - The notification message to send.
*/
module.exports = function(connection, userId, type, message){
    console.log(userId, type, message)
    return new Promise((resolve) => {
        // const STORE = {};
        connection.collection(appConstants.NOTIFICATIONS_TABLE).insertOne({
            notificationId: uuidv4(),
            userId,
            type,
            message,
            createdDatetime: new Date().toISOString(),
            read: false,
        })
        .then(() => {
            // send push!
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