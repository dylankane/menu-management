// src/routes/menuItems.js

const express         = require('express');
const { body }        = require('express-validator');
const controller      = require('../controllers/menuItems');
const { requireAuth } = require('../middleware/auth');
const { validate }    = require('../middleware/validate');
const { upload }      = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

router.get('/',    controller.list);
router.get('/:id', controller.getOne);

router.post(
  '/',
  upload('image'),
  [
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('discount_type').optional().isIn(['flat', 'percent']).withMessage('discount_type must be "flat" or "percent"'),
  ],
  validate,
  controller.create
);

router.put(
  '/:id',
  upload('image'),
  [
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('discount_type').optional().isIn(['flat', 'percent']).withMessage('discount_type must be "flat" or "percent"'),
  ],
  validate,
  controller.update
);

router.delete('/:id', controller.remove);

router.patch('/reorder',              controller.reorderInCategory);
router.patch('/:id/move',             controller.moveToCategory);
router.post('/:id/add-to-category',   controller.addToCategory);

module.exports = router;
