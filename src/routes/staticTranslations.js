// src/routes/staticTranslations.js
// API for managing static customer-facing text translations.
// Keys are seeded automatically on startup by staticTextSync.js.

const express         = require('express');
const { body, param } = require('express-validator');
const prisma          = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { validate }    = require('../middleware/validate');

const router = express.Router();
router.use(requireAuth);

router.put(
  '/:key/:lang',
  [
    param('key').notEmpty().withMessage('key is required'),
    param('lang').notEmpty().withMessage('lang is required'),
    body('value').isString().withMessage('value must be a string'),
  ],
  validate,
  async (req, res, next) => {
    const { key, lang } = req.params;
    const { value } = req.body;
    try {
      await prisma.staticTranslation.upsert({
        where:  { key_lang: { key, lang } },
        update: { value: value ?? '' },
        create: { key, lang, value: value ?? '' },
      });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
