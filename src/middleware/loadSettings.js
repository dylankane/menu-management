// src/middleware/loadSettings.js
// Fetches the singleton RestaurantSettings row and attaches it to res.locals.
// Also attaches UI language helpers (t, uiStrings, uiLang) for admin page translation.

const prisma                                    = require('../config/database');
const { createT, getLocale, resolveUiLang, SUPPORTED } = require('../helpers/i18n');

function detectBrowserLang(req) {
  const header = req.headers['accept-language'] || '';
  const codes  = header.split(',').map(s => s.split(';')[0].trim().toLowerCase().substring(0, 2));
  for (const code of codes) {
    if (SUPPORTED.includes(code)) return code;
  }
  return null;
}

const DEFAULTS = {
  id:                1,
  restaurant_name:   process.env.RESTAURANT_NAME || 'My Restaurant',
  primary_language:  'en',
  enabled_languages: ['en', 'es'],
  logo_svg_url:      null,
  logo_light_url:    null,
  logo_dark_url:     null,
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

    const uiLang = resolveUiLang(req.cookies?.ui_lang || detectBrowserLang(req));
    res.locals.uiLang    = uiLang;
    res.locals.t         = createT(uiLang);
    res.locals.uiStrings = getLocale(uiLang);

    next();
  } catch (err) {
    next(err);
  }
};
