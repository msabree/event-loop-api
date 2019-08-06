var express = require('express');
var router = express.Router();

// TWILIO
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const dbConnect = require('../utils/dbConnect');
const USERS_TABLE = 'users';

router.get('/verification/:phoneNumber/:code', function(req, res, next) {

    const { phoneNumber, code } = req.params;

    dbConnect()
    .then((connection) => {
        return connection.collection(USERS_TABLE).find({ phoneNumber }).toArray();
    })
    .then((arrUsers) => {
        if(arrUsers.length > 1){
            throw new Error('Multiple profiles found');
        }

        let accountExists = false;
        if(arrUsers.length === 1){
            // existing account
            accountExists = true
        }
        
        client.verify.services(process.env.TWILIO_SERVICE_ID)
        .verificationChecks
        .create({to: phoneNumber, code: code})
        .then(verification_check => console.log(verification_check))
        .catch(err => console.log(err))
        
        res.send({
            accountExists,
            message: 'ok'
        })

    })
    .catch((err) => {
        res.send({
            message: 'oops'
        })  
    })
});

router.get('/verification/:phoneNumber', function(req, res, next) {

    const { phoneNumber } = req.params;

    client.verify.services(process.env.TWILIO_SERVICE_ID)
    .verifications
    .create({to: phoneNumber, channel: 'sms'})
    .then(verification => console.log(verification.sid))
    .catch(err => console.log(err))

    res.send('ok')
});



module.exports = router;