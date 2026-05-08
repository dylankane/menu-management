// src/controllers/restaurantSettings.js
// Singleton settings — always upsert on id = 1.

const prisma = require('../config/database');
const { AppError } = require('../utils/errors');

const LOCKED_LANGUAGES = ['en', 'es'];
const MAX_LANGUAGES    = parseInt(process.env.MAX_LANGUAGES || '3', 10);

// GET /api/settings
async function get(req, res, next) {
  try {
    const settings = await prisma.restaurantSettings.findFirst();
    res.json({ data: { settings } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/settings
async function update(req, res, next) {
  try {
    const { restaurant_name, primary_language } = req.body;

    const existing = await prisma.restaurantSettings.findFirst();
    const currentLangs = existing ? existing.enabled_languages : ['en', 'es'];

    if (primary_language && !currentLangs.includes(primary_language)) {
      throw new AppError('primary_language must be one of the enabled languages', 400);
    }

    const data = {};
    if (restaurant_name  !== undefined) data.restaurant_name  = restaurant_name;
    if (primary_language !== undefined) data.primary_language = primary_language;
    if (req.uploadedFile)               data.logo_url         = req.uploadedFile;

    const settings = await prisma.restaurantSettings.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });

    res.json({ data: { settings } });
  } catch (err) {
    next(err);
  }
}

// POST /api/settings/languages  — add a language
async function addLanguage(req, res, next) {
  try {
    const { lang } = req.body;
    if (!lang || typeof lang !== 'string') throw new AppError('lang is required', 400);

    const settings = await prisma.restaurantSettings.findFirst();
    const current  = settings ? [...settings.enabled_languages] : ['en', 'es'];

    if (current.includes(lang)) {
      return res.json({ data: { settings, message: 'Language already enabled' } });
    }

    if (current.length >= MAX_LANGUAGES) {
      throw new AppError(
        `Your plan allows a maximum of ${MAX_LANGUAGES} languages. Upgrade to add more.`,
        403
      );
    }

    const updated = await prisma.restaurantSettings.upsert({
      where: { id: 1 },
      update: { enabled_languages: [...current, lang] },
      create: { id: 1, enabled_languages: [...current, lang] },
    });

    res.json({ data: { settings: updated } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/settings/languages/:lang  — remove a language
async function removeLanguage(req, res, next) {
  try {
    const { lang } = req.params;

    if (LOCKED_LANGUAGES.includes(lang)) {
      throw new AppError(`'${lang}' is a locked language and cannot be removed`, 400);
    }

    const settings = await prisma.restaurantSettings.findFirst();
    const current  = settings ? [...settings.enabled_languages] : ['en', 'es'];

    if (!current.includes(lang)) {
      return res.json({ data: { settings, message: 'Language not enabled' } });
    }

    if (settings && settings.primary_language === lang) {
      throw new AppError('Cannot remove the primary language. Change the primary language first.', 400);
    }

    const updated = await prisma.restaurantSettings.upsert({
      where: { id: 1 },
      update: { enabled_languages: current.filter(l => l !== lang) },
      create: { id: 1, enabled_languages: current.filter(l => l !== lang) },
    });

    res.json({ data: { settings: updated } });
  } catch (err) {
    next(err);
  }
}

module.exports = { get, update, addLanguage, removeLanguage };
