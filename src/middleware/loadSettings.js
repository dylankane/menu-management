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
    const [settings, account] = await Promise.all([
      prisma.restaurantSettings.findFirst(),
      prisma.clientAccount.findFirst(),
    ]);
    res.locals.settings = settings || DEFAULTS;
    res.locals.features = {
      menu:          account?.has_menu            ?? true,
      restaurantHub: account?.has_restaurant_hub  ?? false,
      gourmetClub:   account?.has_gourmet_club    ?? false,
    };
    next();
  } catch (err) {
    next(err);
  }
};
