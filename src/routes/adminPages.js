// src/routes/adminPages.js
// Server-rendered admin page routes.
// Each route fetches the data it needs from Prisma and passes it to an EJS template.
// CRUD operations are handled client-side via fetch to the API (src/routes/*.js).

const express           = require('express');
const bcrypt            = require('bcryptjs');
const QRCode            = require('qrcode');
const prisma            = require('../config/database');
const { signToken, verifyToken } = require('../utils/jwt');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const loadSettings      = require('../middleware/loadSettings');
const { resolveUiLang } = require('../helpers/i18n');

const router = express.Router();

// ── Dashboard helpers ─────────────────────────────────────────────────────────
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

// ── Login ─────────────────────────────────────────────────────────────────────

router.get('/login', (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try { verifyToken(token); return res.redirect('/admin'); } catch {}
  }
  res.render('admin/login', { error: req.query.error || null });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.is_active) {
      return res.redirect('/admin/login?error=Invalid email or password');
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.redirect('/admin/login?error=Invalid email or password');
    }
    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.redirect('/admin');
  } catch {
    res.redirect('/admin/login?error=Something went wrong, please try again');
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/admin/login');
});

// ── Privacy (public — linked from login page) ─────────────────────────────────
router.get('/privacy', (req, res) => {
  res.render('admin/privacy');
});

// ── UI language switch ─────────────────────────────────────────────────────────
router.post('/set-ui-lang', (req, res) => {
  const lang = resolveUiLang(req.body?.lang);
  res.cookie('ui_lang', lang, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  const returnTo = req.headers.referer || '/admin';
  res.redirect(returnTo);
});

// ── All routes below require auth and restaurant settings ─────────────────────
router.use(requireAuth);
router.use(loadSettings);

function restaurantName(res) {
  return res.locals.settings?.restaurant_name || process.env.RESTAURANT_NAME || 'My Restaurant';
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get(['/', '/dashboard'], async (req, res, next) => {
  try {
    const { menu: menuOn, restaurantHub: hubOn, gourmetClub: gcOn } = res.locals.features;
    const menuUrl      = `${process.env.APP_URL || 'http://localhost:3000'}/menu`;
    const gcJoinUrl    = `${process.env.APP_URL || 'http://localhost:3000'}/club-join`;
    const todayDay     = DAYS[new Date().getDay()];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [menuStats, qrDataUrl, recentItems, hubData, gcData, gcJoinQrDataUrl] = await Promise.all([
      menuOn ? Promise.all([
        prisma.menuItem.count(),                                                                         // [0] all menu items
        prisma.category.count({ where: { parent_id: null } }),                                          // [1] categories
        prisma.category.count({ where: { parent_id: { not: null } } }),                                 // [2] subcategories
        prisma.setMenu.count(),                                                                          // [3] all set menus
        prisma.menuItem.count({ where: { is_special: true } }),                                         // [4] special items
        prisma.setMenu.count({ where: { is_special: true } }),                                          // [5] special set menus
        prisma.menuItem.count({ where: { has_discount: true } }),                                       // [6] items with discount
        prisma.setMenu.count({ where: { has_discount: true } }),                                        // [7] set menus with discount
        prisma.menuItem.count({ where: { is_available: false } }),                                      // [8] deactivated items
        prisma.setMenu.count({ where: { is_available: false } }),                                       // [9] deactivated set menus
        prisma.menuItem.findFirst({ orderBy: { updated_at: 'desc' }, select: { updated_at: true } }),   // [10] latest item update
        prisma.setMenu.findFirst({ orderBy: { updated_at: 'desc' }, select: { updated_at: true } }),    // [11] latest set menu update
        prisma.category.findFirst({ orderBy: { updated_at: 'desc' }, select: { updated_at: true } }),  // [12] latest category update
      ]) : Promise.resolve(null),
      menuOn ? QRCode.toDataURL(menuUrl, { width: 200, margin: 2, color: { dark: '#111827', light: '#ffffff' } }) : Promise.resolve(null),
      menuOn ? prisma.menuItem.findMany({
        take: 6,
        orderBy: { created_at: 'desc' },
        select: { id: true, price: true, is_available: true, created_at: true, image_url: true, translations: true },
      }) : Promise.resolve([]),
      hubOn ? Promise.all([
        prisma.openingHours.findMany(),
        prisma.announcement.findFirst(),
        prisma.openingHoursOverride.findFirst({ where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } }),
        prisma.restaurantContact.findFirst(),
      ]) : Promise.resolve(null),
      gcOn ? Promise.all([
        prisma.gourmetClubMember.count({ where: { is_active: true } }),
        prisma.gourmetClubMember.count(),
        prisma.gourmetClubMember.count({ where: { created_at: { gte: startOfMonth } } }),
        prisma.gourmetClubMember.findFirst({ orderBy: { created_at: 'desc' } }),
        prisma.gourmetClubMember.findMany({ take: 3, orderBy: { created_at: 'desc' } }),
        prisma.gourmetClubMember.count({ where: { marketing_consent: true } }),
        prisma.raffle.findFirst({ where: { status: 'active' }, orderBy: { draw_date: 'asc' } }),
        prisma.raffle.findFirst({ where: { status: 'drawn' }, orderBy: { drawn_at: 'desc' }, include: { winner: { select: { name: true } } } }),
      ]) : Promise.resolve(null),
      gcOn ? QRCode.toDataURL(gcJoinUrl, { width: 200, margin: 2, color: { dark: '#111827', light: '#ffffff' } }) : Promise.resolve(null),
    ]);

    const stats = menuStats ? {
      totalItems:         menuStats[0] + menuStats[3],
      totalCategories:    menuStats[1],
      totalSubCategories: menuStats[2],
      totalSetMenus:      menuStats[3],
      totalSpecials:      menuStats[4] + menuStats[5],
      discountCount:      menuStats[6] + menuStats[7],
      deactivatedCount:   menuStats[8] + menuStats[9],
      menuLastUpdated: (() => {
        const dates = [menuStats[10]?.updated_at, menuStats[11]?.updated_at, menuStats[12]?.updated_at].filter(Boolean);
        return dates.length ? dates.reduce((max, d) => d > max ? d : max, dates[0]) : null;
      })(),
    } : {};

    const allHours     = hubData ? hubData[0] : [];
    const announcement = hubData ? hubData[1] : null;
    const nextOverride = hubData ? hubData[2] : null;
    const contact      = hubData ? hubData[3] : null;
    const hoursMap    = Object.fromEntries(allHours.map(h => [h.day, h]));
    const todayHours  = hoursMap[todayDay] || null;

    const openDaysThisWeek = allHours.filter(h => !h.is_closed && h.slot_1_from).length;
    const configuredDays   = allHours.filter(h => h.slot_1_from || h.is_closed).length;
    let nextDayOff = null;
    const todayIdx = new Date().getDay();
    for (let i = 1; i <= 7; i++) {
      const dh = hoursMap[DAYS[(todayIdx + i) % 7]];
      if (dh && dh.is_closed) { nextDayOff = DAYS[(todayIdx + i) % 7]; break; }
    }
    const tomorrowDay = DAYS[(todayIdx + 1) % 7];
    const hoursLastUpdated = allHours.length
      ? allHours.reduce((max, h) => h.updated_at > max ? h.updated_at : max, allHours[0].updated_at)
      : null;
    const SOCIAL_FIELDS = ['instagram_url','facebook_url','tripadvisor_url','google_url','twitter_url','linkedin_url','youtube_url'];
    const socialCount = contact ? SOCIAL_FIELDS.filter(f => contact[f]).length : 0;
    const hubStats = { openDaysThisWeek, configuredDays, nextDayOff, tomorrowDay, hoursLastUpdated, socialCount };

    const gcStats = gcData ? {
      activeMembers:      gcData[0],
      totalMembers:       gcData[1],
      joinedThisMonth:    gcData[2],
      lastMember:         gcData[3],
      recentMembers:      gcData[4],
      consentCount:       gcData[5],
      activeRaffle:       gcData[6] || null,
      lastWinnerName:     gcData[7]?.winner?.name ?? null,
      daysUntilDraw: (() => {
        if (!gcData[6]?.draw_date) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const d = new Date(gcData[6].draw_date); d.setHours(0, 0, 0, 0);
        return Math.max(0, Math.round((d - today) / 86400000));
      })(),
    } : null;

    res.render('admin/dashboard', {
      user: req.user,
      stats,
      recentItems,
      qrDataUrl,
      menuUrl,
      todayHours,
      todayDay,
      hoursMap,
      hubStats,
      announcement,
      nextOverride,
      contact,
      gcStats,
      gcJoinUrl,
      gcJoinQrDataUrl,
      current: 'dashboard',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
    });
  } catch (err) { next(err); }
});

// ── Builder ───────────────────────────────────────────────────────────────────
router.get('/builder', async (req, res, next) => {
  if (!res.locals.features.menu) return res.redirect('/admin');
  try {
    const WITH_TRANS = { translations: { orderBy: { lang: 'asc' } } };
    const DISH_INCLUDE = {
      include: {
        menu_item: { include: WITH_TRANS },
      },
      orderBy: { display_order: 'asc' },
    };
    const SET_MENU_INCLUDE = {
      include: {
        set_menu: { include: WITH_TRANS },
      },
      orderBy: { display_order: 'asc' },
    };

    const [categories, allergens, dietaryTags, allItems, allSetMenus] = await Promise.all([
      prisma.category.findMany({
        where: { parent_id: null },
        include: {
          ...WITH_TRANS,
          _count: { select: { menu_item_categories: true, set_menu_categories: true } },
          children: {
            include: {
              ...WITH_TRANS,
              _count: { select: { menu_item_categories: true, set_menu_categories: true } },
              menu_item_categories: DISH_INCLUDE,
              set_menu_categories:  SET_MENU_INCLUDE,
            },
            orderBy: { display_order: 'asc' },
          },
          menu_item_categories: DISH_INCLUDE,
          set_menu_categories:  SET_MENU_INCLUDE,
        },
        orderBy: { display_order: 'asc' },
      }),
      prisma.allergenTag.findMany({ include: { translations: true }, orderBy: { id: 'asc' } }),
      prisma.dietaryTag.findMany({ include: { translations: true }, orderBy: { id: 'asc' } }),
      prisma.menuItem.findMany({
        include: { translations: { orderBy: { lang: 'asc' } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.setMenu.findMany({
        include: { translations: { orderBy: { lang: 'asc' } } },
        orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
      }),
    ]);

    res.render('admin/builder', {
      user: req.user,
      categories,
      allergens,
      dietaryTags,
      allItems,
      allSetMenus,
      current: 'builder',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
    });
  } catch (err) { next(err); }
});

// ── Menu Items ────────────────────────────────────────────────────────────────
router.get('/menu-items', async (req, res, next) => {
  if (!res.locals.features.menu) return res.redirect('/admin');
  try {
    const [items, categories, allergens, dietaryTags] = await Promise.all([
      prisma.menuItem.findMany({
        include: {
          translations: true,
          categories:      { include: { category: { include: { translations: true } } } },
          allergens:       { include: { allergen: { include: { translations: true } } } },
          dietary:         { include: { dietary_tag: { include: { translations: true } } } },
          set_menu_dishes: {
            select: {
              set_menu: { select: { id: true, translations: { select: { lang: true, name: true } } } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.category.findMany({
        include: {
          translations: true,
          children: { include: { translations: true }, orderBy: { display_order: 'asc' } },
        },
        orderBy: [{ parent_id: 'asc' }, { display_order: 'asc' }],
      }),
      prisma.allergenTag.findMany({ include: { translations: true }, orderBy: { id: 'asc' } }),
      prisma.dietaryTag.findMany({ include: { translations: true }, orderBy: { id: 'asc' } }),
    ]);
    res.render('admin/menu-items', {
      user: req.user, items, categories, allergens, dietaryTags,
      current: 'menu-items',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
    });
  } catch (err) { next(err); }
});

// ── Set Menus ─────────────────────────────────────────────────────────────────
router.get('/set-menus', async (req, res, next) => {
  if (!res.locals.features.menu) return res.redirect('/admin');
  try {
    const [setMenus, categories, dishes, courses, allergens, dietaryTags] = await Promise.all([
      prisma.setMenu.findMany({
        include: {
          translations: true,
          categories: {
            include: { category: { include: { translations: true } } },
            orderBy: { display_order: 'asc' },
          },
          courses: {
            include: {
              course:       { include: { translations: true } },
              translations: true,
              dishes: {
                include: {
                  dish:         { include: { translations: true } },
                  translations: true,
                },
                orderBy: { display_order: 'asc' },
              },
            },
            orderBy: { display_order: 'asc' },
          },
          dishes: {
            where:   { set_menu_course_id: null },
            include: {
              dish:         { include: { translations: true } },
              translations: true,
            },
            orderBy: { display_order: 'asc' },
          },
        },
        orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
      }),
      prisma.category.findMany({
        include: {
          translations: true,
          children: { include: { translations: true }, orderBy: { display_order: 'asc' } },
        },
        orderBy: [{ parent_id: 'asc' }, { display_order: 'asc' }],
      }),
      prisma.menuItem.findMany({
        include: { translations: true },
      }),
      prisma.course.findMany({
        include: { translations: true },
      }),
      prisma.allergenTag.findMany({ include: { translations: true }, orderBy: { id: 'asc' } }),
      prisma.dietaryTag.findMany({ include: { translations: true }, orderBy: { id: 'asc' } }),
    ]);
    const uiLang = res.locals.uiLang || 'en';
    const getName = (translations) => {
      const t = (translations || []).find(t => t.lang === uiLang)
             || (translations || []).find(t => t.lang === 'en')
             || (translations || [])[0];
      return (t?.name || '').toLowerCase();
    };
    dishes.sort((a, b)  => getName(a.translations).localeCompare(getName(b.translations)));
    courses.sort((a, b) => getName(a.translations).localeCompare(getName(b.translations)));
    res.render('admin/set-menus', {
      user: req.user, setMenus, categories, dishes, courses, allergens, dietaryTags,
      current: 'set-menus',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
    });
  } catch (err) { next(err); }
});

// ── Courses ───────────────────────────────────────────────────────────────────
router.get('/courses', async (req, res, next) => {
  if (!res.locals.features.menu) return res.redirect('/admin');
  try {
    const courses = await prisma.course.findMany({
      include: { translations: true },
      orderBy: { display_order: 'asc' },
    });
    res.render('admin/courses', {
      user: req.user, courses, current: 'courses',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
    });
  } catch (err) { next(err); }
});

// ── Tags (allergens + dietary) ────────────────────────────────────────────────
router.get('/tags', async (req, res, next) => {
  if (!res.locals.features.menu) return res.redirect('/admin');
  try {
    const [allergens, dietaryTags] = await Promise.all([
      prisma.allergenTag.findMany({ include: { translations: true }, orderBy: { id: 'asc' } }),
      prisma.dietaryTag.findMany({ include: { translations: true }, orderBy: { id: 'asc' } }),
    ]);
    res.render('admin/tags', {
      user: req.user, allergens, dietaryTags, current: 'tags',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
    });
  } catch (err) { next(err); }
});

// ── Restaurant ────────────────────────────────────────────────────────────────
router.get('/restaurant', async (req, res, next) => {
  if (!res.locals.features.restaurantHub) return res.redirect('/admin');
  try {
    const [contact, openingHours, overrides, announcement] = await Promise.all([
      prisma.restaurantContact.findFirst(),
      prisma.openingHours.findMany({ orderBy: { id: 'asc' } }),
      prisma.openingHoursOverride.findMany({ orderBy: { date: 'asc' } }),
      prisma.announcement.findFirst(),
    ]);
    res.render('admin/restaurant', {
      user: req.user,
      contact:      contact      || {},
      openingHours: openingHours || [],
      overrides:    overrides    || [],
      announcement: announcement || {},
      current: 'restaurant',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
    });
  } catch (err) { next(err); }
});

// ── Settings ──────────────────────────────────────────────────────────────────
router.get('/settings', async (req, res, next) => {
  try {
    const account = await prisma.clientAccount.findFirst();
    const acc = account || {};
    res.render('admin/settings', {
      user: req.user, current: 'settings',
      restaurantName: restaurantName(res),
      maxLanguages: acc.max_languages ?? 3,
      settings: res.locals.settings,
      account: acc,
      features: res.locals.features,
    });
  } catch (err) { next(err); }
});

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile', async (req, res, next) => {
  try {
    const usersWhere = req.user.role === 'super_admin' ? {} : { role: { not: 'super_admin' } };
    const [user, users] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, name: true, role: true },
      }),
      prisma.user.findMany({
        where:   usersWhere,
        select:  { id: true, email: true, name: true, role: true, created_at: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);
    res.render('admin/profile', {
      user, users, current: 'profile',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
    });
  } catch (err) { next(err); }
});

// ── Support ───────────────────────────────────────────────────────────────────
router.get('/support', (req, res) => {
  res.render('admin/support', {
    user: req.user,
    current: 'support',
    restaurantName: restaurantName(res),
    settings: res.locals.settings,
  });
});

// ── Gourmet Club ──────────────────────────────────────────────────────────────
router.get('/gourmet-club', async (req, res, next) => {
  if (!res.locals.features.gourmetClub) return res.redirect('/admin');
  try {
    const gcJoinUrl = `${process.env.APP_URL || 'http://localhost:3000'}/club-join`;
    const [members, consentCount, gcJoinQrDataUrl, clientAccount] = await Promise.all([
      prisma.gourmetClubMember.findMany({
        orderBy: { created_at: 'desc' },
        include: { _count: { select: { visits: true } } },
      }),
      prisma.gourmetClubMember.count({ where: { is_active: true, marketing_consent: true } }),
      QRCode.toDataURL(gcJoinUrl, { width: 200, margin: 2, color: { dark: '#111827', light: '#ffffff' } }),
      prisma.clientAccount.findFirst(),
    ]);
    res.render('admin/gourmet-club/members', {
      user: req.user, current: 'gc-members',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
      members,
      consentCount,
      gcJoinUrl,
      gcJoinQrDataUrl,
      gcPaperFormFrontUrl: clientAccount?.gc_paper_form_front_url || null,
      gcPaperFormBackUrl:  clientAccount?.gc_paper_form_back_url  || null,
    });
  } catch (err) { next(err); }
});

router.get('/gourmet-club/raffles', async (req, res, next) => {
  if (!res.locals.features.gourmetClub) return res.redirect('/admin');
  try {
    const raffles = await prisma.raffle.findMany({
      orderBy: { created_at: 'desc' },
      include: { winner: { select: { id: true, name: true, email: true } } },
    });
    res.render('admin/gourmet-club/raffles', {
      user: req.user, current: 'gc-raffles',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
      raffles,
    });
  } catch (err) { next(err); }
});

router.get('/gourmet-club/communications', async (req, res, next) => {
  if (!res.locals.features.gourmetClub) return res.redirect('/admin');
  try {
    const consentCount = await prisma.gourmetClubMember.count({ where: { is_active: true, marketing_consent: true } });
    res.render('admin/gourmet-club/communications', {
      user: req.user, current: 'gc-communications',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
      consentCount,
    });
  } catch (err) { next(err); }
});

// ── Menu Translations ─────────────────────────────────────────────────────────
router.get('/menu-translations', async (req, res, next) => {
  if (!res.locals.features.menu) return res.redirect('/admin');
  try {
    const [rows, settings] = await Promise.all([
      prisma.staticTranslation.findMany({ orderBy: [{ key: 'asc' }, { lang: 'asc' }] }),
      prisma.restaurantSettings.findFirst({ select: { enabled_languages: true } }),
    ]);
    const enabledLangs = (settings?.enabled_languages) || ['en', 'es'];

    // Group rows by key: { key -> { lang -> value } }
    const byKey = {};
    rows.forEach(r => {
      if (!byKey[r.key]) byKey[r.key] = {};
      byKey[r.key][r.lang] = r.value;
    });

    res.render('admin/menu-translations', {
      user: req.user,
      current: 'menu-translations',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
      byKey,
      enabledLangs,
    });
  } catch (err) { next(err); }
});

// ── Config (super admin only) ─────────────────────────────────────────────────
router.get('/config', requireSuperAdmin, async (req, res, next) => {
  try {
    const account = await prisma.clientAccount.findFirst();
    res.render('admin/config', {
      user: req.user, current: 'config',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
      account: account || {},
    });
  } catch (err) { next(err); }
});

module.exports = router;
