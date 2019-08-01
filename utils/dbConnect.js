const mongo = require('mongodb').MongoClient;

const connect = function(){

    let databaseName = 'flaker-dev'; // dev database name here
    if(process.env.NODE_ENV === 'production'){
        databaseName = 'flaker-prod'; // production database name here
    }

    return new Promise((resolve, reject) => {
        mongo.connect(process.env.MONGODB_URI, { useNewUrlParser: true }, (err, database) => {
            if(err){
                reject(err);
            }
            else{
                resolve(database.db(databaseName));
            }
        });
    });
}

module.exports = connect;