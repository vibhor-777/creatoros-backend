const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
router.get('/public', statsController.getPublicStats);
router.get('/leaderboards', statsController.getLeaderboards);
module.exports = router;
