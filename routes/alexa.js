var express = require('express');
var router = express.Router();

const dbConnect = require('../utils/dbConnect');

router.get('/verification-codes', function(req, res, next) {
    dbConnect()
    .then((connection) => {
        console.log('Hello World')
        res.send({
            codeOne: 'red',
            codeTwo: '15'
        });
    })
    .catch(() => {
        res.send({
            codeOne: 'red',
            codeTwo: '15'
        });
    })
});

module.exports = router;
