var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(_, res) {
  res.render('index', { title: 'Flaker Dev API' });
});

module.exports = router;
