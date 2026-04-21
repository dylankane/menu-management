// src/routes/users.js

const express         = require('express');
const { body }        = require('express-validator');
const controller      = require('../controllers/users');
const { requireAuth } = require('../middleware/auth');
const { validate }    = require('../middleware/validate');

const router = express.Router();

// All user routes require authentication
router.use(requireAuth);

router.get('/me', controller.getMe);

router.put(
  '/me',
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Must be a valid email'),
  ],
  validate,
  controller.updateMe
);

router.put(
  '/me/password',
  [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  validate,
  controller.changePassword
);

module.exports = router;
