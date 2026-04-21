// src/routes/restaurantSettings.js

const express         = require('express');
const { body }        = require('express-validator');
const controller      = require('../controllers/restaurantSettings');
const { requireAuth } = require('../middleware/auth');
const { validate }    = require('../middleware/validate');
const { upload }      = require('../middleware/upload');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.get);

router.put(
  '/',
  upload('logo'),
  [
    body('primary_language').optional().isString().withMessage('primary_language must be a string'),
  ],
  validate,
  controller.update
);

router.post(
  '/languages',
  [body('lang').notEmpty().withMessage('lang is required')],
  validate,
  controller.addLanguage
);

router.delete('/languages/:lang', controller.removeLanguage);

module.exports = router;
