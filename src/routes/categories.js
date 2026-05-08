// src/routes/categories.js

const express         = require('express');
const { body }        = require('express-validator');
const controller      = require('../controllers/categories');
const { requireAuth } = require('../middleware/auth');
const { validate }    = require('../middleware/validate');
const { upload }      = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

router.get('/',      controller.list);
router.get('/flat',  controller.listFlat);
router.patch('/reorder', controller.reorder);

router.post(
  '/',
  upload('image'),
  [
    body('parent_id').optional().isInt().withMessage('parent_id must be an integer'),
    body('display_order').optional().isInt().withMessage('display_order must be an integer'),
  ],
  validate,
  controller.create
);

router.put(
  '/:id',
  upload('image'),
  [
    body('display_order').optional().isInt().withMessage('display_order must be an integer'),
  ],
  validate,
  controller.update
);

router.delete('/:id', controller.remove);

module.exports = router;
