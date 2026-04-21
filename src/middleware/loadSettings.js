// src/middleware/loadSettings.js
// Fetches the singleton RestaurantSettings row and attaches it to res.locals.
// Applied to all admin routes so every template has access to language config.

const prisma = require('../config/database');

const DEFAULTS = {
  id:                1,
  restaurant_name:   process.env.RESTAURANT_NAME || 'My Restaurant',
  primary_language:  'en',
  enabled_languages: ['en', 'es'],
  logo_url:          null,
  address:           null,
  phone:             null,
  website:           null,
  social_links:      null,
};

module.exports = async function loadSettings(req, res, next) {
  try {
    const settings = await prisma.restaurantSettings.findFirst();
    res.locals.settings = settings || DEFAULTS;
    next();
  } catch (err) {
    next(err);
  }
};
