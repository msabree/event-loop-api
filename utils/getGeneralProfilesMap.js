const appConstants = require('./constants');

/**
 * Creates a map of profiles based on a passed in array of userIds.
 * @param {String} arrUserIds - Array of userIds to use in the lookup.
 * @param {Object} connection - Open connection to the data store.
*/
module.exports = function(connection, arrUserIds){
    return new Promise((resolve, reject) => {
        connection.collection(appConstants.USERS_TABLE).find({userId: {$in: arrUserIds}}).toArray()
        .then((arrUserProfiles) => {
            const profilesMap = {};
            for(let i = 0; i < arrUserProfiles.length; i++){
                // TO DO: DELETE ANY INFO FROM PROFILE THAT SHOULD NOT GET RETURNED TO CLIENT
                profilesMap[arrUserProfiles[i].userId] = arrUserProfiles[i];
            }
            resolve(profilesMap);
        })
        .catch((err) => {
            reject(err);
        })
    })
}