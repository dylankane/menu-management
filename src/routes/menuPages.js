// src/routes/menuPages.js
// Public customer-facing menu — no authentication required.
// Language detection: ?lang= param → browser Accept-Language → first enabled language.
// Translation fallback: requested lang → Spanish → English.

const express = require('express');
const prisma  = require('../config/database');

const router = express.Router();

// Detect the best language for this request.
// Priority: explicit ?lang= param → browser language → first enabled language.
function detectLang(req, enabledLangs) {
  if (req.query.lang && enabledLangs.includes(req.query.lang)) {
    return req.query.lang;
  }
  const acceptHeader = req.headers['accept-language'] || '';
  const preferred = acceptHeader
    .split(',')
    .map(s => s.split(';')[0].trim().toLowerCase().substring(0, 2));
  for (const code of preferred) {
    if (enabledLangs.includes(code)) return code;
  }
  return enabledLangs[0] || 'es';
}

// Pick the best translation from an array.
// Fallback chain: requested lang → Spanish → English → first available.
function pickT(translations, lang) {
  if (!translations || translations.length === 0) return {};
  const map = {};
  for (const t of translations) map[t.lang] = t;
  return map[lang] || map['es'] || map['en'] || translations[0] || {};
}

// Build an mt() function from static translation rows.
// Fallback chain: requested lang → Spanish → English → key name.
function buildMt(rows, lang) {
  const maps = { [lang]: {}, es: {}, en: {} };
  rows.forEach(r => {
    if (maps[r.lang] !== undefined) maps[r.lang][r.key] = r.value || '';
  });
  return function mt(key) {
    return maps[lang][key] || maps['es'][key] || maps['en'][key] || key;
  };
}

const CATEGORY_INCLUDE = {
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
        set_menu_categories: {
          orderBy: { display_order: 'asc' },
          include: {
            set_menu: {
              include: {
                translations: true,
                courses: {
                  orderBy: { display_order: 'asc' },
                  include: {
                    course: { include: { translations: true } },
                    translations: true,
                    dishes: {
                      orderBy: { display_order: 'asc' },
                      include: {
                        dish: {
                          include: {
                            translations: true,
                            allergens: { include: { allergen: { include: { translations: true } } } },
                            dietary:   { include: { dietary_tag: { include: { translations: true } } } },
                          },
                        },
                        translations: true,
                      },
                    },
                  },
                },
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
    set_menu_categories: {
      orderBy: { display_order: 'asc' },
      include: {
        set_menu: {
          include: {
            translations: true,
            courses: {
              orderBy: { display_order: 'asc' },
              include: {
                course: { include: { translations: true } },
                translations: true,
                dishes: {
                  orderBy: { display_order: 'asc' },
                  include: {
                    dish: {
                      include: {
                        translations: true,
                        allergens: { include: { allergen: { include: { translations: true } } } },
                        dietary:   { include: { dietary_tag: { include: { translations: true } } } },
                      },
                    },
                    translations: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  orderBy: { display_order: 'asc' },
};

// ── Legal / Privacy Page ──────────────────────────────────────────────────────
router.get('/legal', async (req, res, next) => {
  try {
    const settings     = await prisma.restaurantSettings.findUnique({ where: { id: 1 } });
    const enabledLangs = settings?.enabled_languages || ['es', 'en'];
    const lang         = detectLang(req, enabledLangs);
    res.render('customer/legal', {
      lang,
      enabledLangs,
      restaurantName: settings?.restaurant_name || 'Restaurant',
    });
  } catch (err) {
    next(err);
  }
});

// ── Gourmet Club Sign-up Page ─────────────────────────────────────────────────
router.get('/club-join', async (req, res, next) => {
  try {
    const settings     = await prisma.restaurantSettings.findUnique({ where: { id: 1 } });
    const enabledLangs = settings?.enabled_languages || ['es', 'en'];
    const lang         = detectLang(req, enabledLangs);

    const langsToFetch = [...new Set([lang, 'es', 'en'])];
    const staticRows   = await prisma.staticTranslation.findMany({ where: { lang: { in: langsToFetch } } });
    const mt           = buildMt(staticRows, lang);

    res.render('customer/club-join', {
      lang,
      enabledLangs,
      restaurantName: settings?.restaurant_name || 'Restaurant',
      mt,
    });
  } catch (err) {
    next(err);
  }
});

// ── Customer Menu ─────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const account = await prisma.clientAccount.findFirst();
    if (account && account.has_menu === false) {
      return res.status(404).send('Not found');
    }

    const settingsRow  = await prisma.restaurantSettings.findFirst();
    const settings     = settingsRow || {
      restaurant_name:   process.env.RESTAURANT_NAME || 'Our Menu',
      enabled_languages: ['es', 'en'],
    };

    const enabledLangs = settings.enabled_languages;
    const lang         = detectLang(req, enabledLangs);

    const langsToFetch = [...new Set([lang, 'es', 'en'])];
    const [categories, staticRows] = await Promise.all([
      prisma.category.findMany(CATEGORY_INCLUDE),
      prisma.staticTranslation.findMany({ where: { lang: { in: langsToFetch } } }),
    ]);

    function isVisible(mi)      { return mi && mi.is_available; }
    function isSetMenuVisible(sm){ return sm && sm.is_available; }
    function catHasContent(cat) {
      const directItems    = (cat.menu_item_categories || []).some(mic => isVisible(mic.menu_item));
      const directSetMenus = (cat.set_menu_categories  || []).some(smc => isSetMenuVisible(smc.set_menu));
      const childItems     = (cat.children || []).some(child =>
        (child.menu_item_categories || []).some(mic => isVisible(mic.menu_item))
      );
      const childSetMenus  = (cat.children || []).some(child =>
        (child.set_menu_categories  || []).some(smc => isSetMenuVisible(smc.set_menu))
      );
      return directItems || directSetMenus || childItems || childSetMenus;
    }

    const visibleCategories = categories.filter(catHasContent);
    const mt                = buildMt(staticRows, lang);

    res.render('customer/index', {
      categories: visibleCategories,
      settings,
      lang,
      enabledLangs,
      restaurantName: settings.restaurant_name,
      pickT: (translations) => pickT(translations, lang),
      mt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
