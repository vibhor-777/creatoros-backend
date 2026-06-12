const express = require('express');
const healthController = require('../controllers/healthController');

const router = express.Router();

router.get('/', healthController.healthCheck);
router.get('/stats', healthController.platformStats);

module.exports = router;
