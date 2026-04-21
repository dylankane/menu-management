// src/routes/setMenus.js

const express         = require('express');
const { body }        = require('express-validator');
const controller      = require('../controllers/setMenus');
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
  ],
  validate,
  controller.create
);

router.put(
  '/:id',
  upload('image'),
  [
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  ],
  validate,
  controller.update
);

router.delete('/:id', controller.remove);

// Set menu dishes
router.post(
  '/:id/dishes',
  [body('dish_id').isInt().withMessage('dish_id is required')],
  validate,
  controller.addDish
);

router.put('/:id/dishes/:dishId', controller.updateDish);
router.delete('/:id/dishes/:dishId', controller.removeDish);

module.exports = router;
