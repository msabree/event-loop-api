const mongo = require('mongodb').MongoClient;

const connect = function(){

    let databaseName = 'heroku_7f4tfncn'; // dev database name here
    if(process.env.NODE_ENV === 'production'){
        databaseName = ''; // production database name here
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