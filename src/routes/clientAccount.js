const express         = require('express');
const controller      = require('../controllers/clientAccount');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', controller.get);
router.put('/', controller.update);

module.exports = router;
