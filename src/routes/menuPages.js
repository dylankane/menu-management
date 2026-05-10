// src/routes/menuPages.js
// Public customer-facing menu — no authentication required.
// Resolves the display language from: ?lang= → Accept-Language → primary_language → 'en'.

const express = require('express');
const prisma  = require('../config/database');

const router = express.Router();

// Detect the best language to use for this request
function detectLang(req, enabledLangs, primaryLang) {
  // 1. Explicit query param
  if (req.query.lang && enabledLangs.includes(req.query.lang)) {
    return req.query.lang;
  }
  // 2. Accept-Language header (first match)
  const acceptHeader = req.headers['accept-language'] || '';
  const preferred = acceptHeader.split(',').map(s => s.split(';')[0].trim().toLowerCase().substring(0, 2));
  for (const code of preferred) {
    if (enabledLangs.includes(code)) return code;
  }
  // 3. Primary language
  return primaryLang || 'en';
}

// Pick the best translation from an array
function pickT(translations, lang, primary) {
  if (!translations || translations.length === 0) return {};
  const map = {};
  for (const t of translations) map[t.lang] = t;
  return map[lang] || map[primary] || translations[0] || {};
}

const CATEGORY_INCLUDE = (lang, primary) => ({
  where: { is_active: true, parent_id: null },
  include: {
    translations: true,
    children: {
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      include: {
        translations: true,
        menu_item_categories: {
          orderBy: { display_order: 'asc' },
          include: {
            menu_item: {
              include: {
                translations: true,
                allergens: { include: { allergen: { include: { translations: true } } } },
                dietary:   { include: { dietary_tag: { include: { translations: true } } } },
              },
            },
          },
        },
      },
    },
    menu_item_categories: {
      orderBy: { display_order: 'asc' },
      include: {
        menu_item: {
          include: {
            translations: true,
            allergens: { include: { allergen: { include: { translations: true } } } },
            dietary:   { include: { dietary_tag: { include: { translations: true } } } },
          },
        },
      },
    },
  },
  orderBy: { display_order: 'asc' },
});

router.get('/', async (req, res, next) => {
  try {
    const account = await prisma.clientAccount.findFirst();
    if (account && account.has_menu === false) {
      return res.status(404).send('Not found');
    }

    const settingsRow = await prisma.restaurantSettings.findFirst();
    const settings = settingsRow || {
      restaurant_name:   process.env.RESTAURANT_NAME || 'Our Menu',
      primary_language:  'en',
      enabled_languages: ['en', 'es'],
    };

    const enabledLangs = settings.enabled_languages;
    const primaryLang  = settings.primary_language;
    const lang         = detectLang(req, enabledLangs, primaryLang);

    const categories = await prisma.category.findMany(CATEGORY_INCLUDE(lang, primaryLang));

    // Filter to categories that have at least one visible item
    function isVisible(mi) {
      return mi && mi.is_available;
    }
    function catHasContent(cat) {
      const directVisible = (cat.menu_item_categories || []).some(mic => isVisible(mic.menu_item));
      const childVisible  = (cat.children || []).some(child =>
        (child.menu_item_categories || []).some(mic => isVisible(mic.menu_item))
      );
      return directVisible || childVisible;
    }

    const visibleCategories = categories.filter(catHasContent);

    res.render('menu/index', {
      categories: visibleCategories,
      settings,
      lang,
      primaryLang,
      restaurantName: settings.restaurant_name,
      pickT: (translations) => pickT(translations, lang, primaryLang),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
