const express = require('express');
const { auth } = require('../middleware/auth');
const serviceController = require('../controllers/serviceController');

const router = express.Router();

router.get('/', serviceController.listServices);
router.get('/:serviceId', serviceController.getServiceById);
router.post('/', auth, serviceController.createService);
router.post('/:serviceId/request', auth, serviceController.requestService);

module.exports = router;
