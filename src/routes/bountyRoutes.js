const express = require('express');
const { auth } = require('../middleware/auth');
const bountyController = require('../controllers/bountyController');

const router = express.Router();

router.get('/', bountyController.listBounties);
router.post('/', auth, bountyController.createBounty);
router.post('/:bountyId/apply', auth, bountyController.applyToBounty);
router.post('/:bountyId/close', auth, bountyController.closeBounty);

module.exports = router;
