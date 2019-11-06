var express = require('express');
var router = express.Router();
// const uuidv4 = require('uuid/v4');
// const findIndex = require('lodash/findIndex');

// const appConstants = require('../utils/constants');
// const dbConnect = require('../utils/dbConnect');
// const getSession = require('../utils/getSession');

router.post('/', function(req, res) {
    
    const { members, title } = req.body;
    const sessionToken = req.get('USER-SESSION-TOKEN');
    console.log(members, title, sessionToken);

    Promise.resolve().then(() => {
        res.send({
            success: true,
            message: '',
        })        
    })
    .catch((err) => {
        res.send({
            success: false,
            message: err.message || err
        })  
    })
});

module.exports = router;
