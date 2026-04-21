// src/routes/auth.js

const express        = require('express');
const { body }       = require('express-validator');
const rateLimit      = require('express-rate-limit');
const controller     = require('../controllers/auth');
const { requireAuth } = require('../middleware/auth');
const { validate }   = require('../middleware/validate');

const router = express.Router();

// Stricter rate limit for login — prevents brute-force attacks.
// 10 attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('A valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  controller.login
);

router.post('/logout', controller.logout);

router.get('/me', requireAuth, controller.me);

module.exports = router;
