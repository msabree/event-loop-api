/**
 * Ensure that a sessionToken is valid before returning data from API.
 * @param {String} sessionToken
*/

const USERS_TABLE = 'users';

module.exports = function(sessionToken, connection){
    return new Promise((resolve, reject) => {
        connection.collection(USERS_TABLE).find({sessionToken}).toArray()
        .then((arrUsers) => {
            if(arrUsers.length === 1){
                resolve(arrUsers[0]);
            }
            else{
                reject({
                    message: `Invalid session.`
                });
            }
        })
        .catch((err) => {
            reject(err);
        })
    })
}