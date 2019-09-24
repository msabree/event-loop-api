const appConstants = require('./constants');

/**
 * Creates a map for a user's friends list to get associated profile info quickly.
 * @param {String} userId - The user making the request.
 * @param {Object} connection - Open connection to the data store.
*/
module.exports = function(connection, userId){
    return new Promise((resolve, reject) => {
        const STORE = {};
        connection.collection(appConstants.FRIENDS_TABLE).find({ userId }).toArray()
        .then((arrFriends) => {
            STORE.arrFriends = arrFriends;
            const arrFriendsUserIds = arrFriends.map((friend) => {
                return friend.friendUserId;
            })
            return connection.collection(appConstants.USERS_TABLE).find({userId: {$in: arrFriendsUserIds}}).toArray();
        })
        .then((arrFriendsProfiles) => {
            const friendsProfileMap = {};
            for(let i = 0; i < arrFriendsProfiles.length; i++){
                // DELETE ANY INFO FROM PROFILE THAT SHOULD NOT GET RETURNED TO CLIENT
                friendsProfileMap[arrFriendsProfiles[i].userId] = arrFriendsProfiles[i];
            }
            resolve(friendsProfileMap);
        })
        .catch((err) => {
            reject(err);
        })
    })
}