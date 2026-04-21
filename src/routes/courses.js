// src/routes/courses.js

const express         = require('express');
const controller      = require('../controllers/courses');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/',       controller.list);
router.post('/',      controller.create);
router.put('/:id',    controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
