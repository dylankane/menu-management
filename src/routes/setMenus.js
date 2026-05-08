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

router.patch('/reorder',             controller.reorder);
router.patch('/reorder-in-category', controller.reorderInCategory);

// Set menu courses — specific paths before parameterised ones
router.post('/:id/courses',                controller.addCourse);
router.patch('/:id/courses/reorder',       controller.reorderCourses);
router.patch('/:id/courses/:courseId',     controller.updateCourse);
router.delete('/:id/courses/:courseId',    controller.removeCourse);

// Set menu dishes
router.post(
  '/:id/dishes',
  [body('dish_id').isInt().withMessage('dish_id is required')],
  validate,
  controller.addDish
);

router.patch('/:id/dishes/reorder',          controller.reorderDishes);
router.patch('/:id/move-category',           controller.moveCategory);
router.put('/:id/dishes/:entryId',           controller.updateDish);
router.delete('/:id/dishes/:entryId',        controller.removeDish);
router.delete('/:id/categories/:catId',      controller.removeFromCategory);

module.exports = router;
