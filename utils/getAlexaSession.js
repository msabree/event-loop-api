/**
 * Ensure that a sessionToken is valid before returning data from API.
 * @param {String} alexaSessionToken - The requesting user's alexa device session token string.
 * @param {Object} connection - An open connection to the data store.
*/

const USERS_TABLE = 'users';

module.exports = function(alexaSessionToken, connection){
    return new Promise((resolve, reject) => {
        connection.collection(USERS_TABLE).find({alexaSessionToken, alexaSessionTokenActive: true}).toArray()
        .then((arrUsers) => {
            if(arrUsers.length === 1){
                resolve(arrUsers[0]);
            }
            else{
                reject({
                    message: `
                    This alexa device is not active. Either the pairing process is not complete or the session has expired.
                    To create a new session please open the mobile app and follow the instructions in the Alexa settings.
                    `
                });
            }
        })
        .catch((err) => {
            reject(err);
        })
    })
}