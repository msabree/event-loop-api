var express = require('express');
var router = express.Router();

const dbConnect = require('../utils/dbConnect');

// Generate codes for a user
router.get('/verification-codes', function(req, res, next) {
    dbConnect()
    .then((connection) => {
        
        const randomFourDigitInt = Math.floor(1000 + Math.random() * 9000);
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        res.send({
            codeOne: randomColor,
            codeTwo: randomFourDigitInt
        });
    })
    .catch((err) => {
        res.send({
            message: 'oops',
            err,
        });
    })
});

// Alexa endpoint to sync device with app profile
router.post('/sync-profile', function(req, res, next) {

    const { codeOne, codeTwo, alexaMetaData } = req.body;

    dbConnect()
    .then((connection) => {
        
        console.log(codeOne, codeTwo)

        // once we have alexa sending codes we'd need to find the user's profile who initiated the sync

        res.send({
            message: 'ok'
        });
    })
    .catch((err) => {
        res.send({
            message: 'oops',
            err,
        });
    })
});

module.exports = router;
