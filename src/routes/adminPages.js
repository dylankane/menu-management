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

const router = express.Router();

// ── Dashboard helpers ─────────────────────────────────────────────────────────
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

function buildDashCards(features, stats, todayHours, openDaysThisWeek, announcement, gcStats) {
  const M = { feature: 'Menu',           featureKey: 'menu', icon: 'menu-items' };
  const H = { feature: 'Restaurant Hub', featureKey: 'hub',  icon: 'building'   };
  const G = { feature: 'Gourmet Club',   featureKey: 'gc',   icon: 'star'       };

  const menuCards = [
    { ...M, value: stats.liveItems   ?? 0, label: 'Live Items', link: '/admin/menu-items' },
    { ...M, value: stats.totalSetMenus ?? 0, label: 'Set Menus',  link: '/admin/set-menus'  },
    { ...M, value: stats.totalSpecials ?? 0, label: 'Specials',   link: '/admin/menu-items' },
  ];

  const todayOpen = todayHours && !todayHours.is_closed;
  const hoursConfigured = todayOpen && todayHours.slot_1_from;

  let hoursValue, hoursLabel, hoursIsStatus;
  if (!todayHours) {
    hoursValue = '—'; hoursLabel = 'Not configured'; hoursIsStatus = false;
  } else if (todayHours.is_closed) {
    hoursValue = 'Closed'; hoursLabel = 'Closed today'; hoursIsStatus = true;
  } else if (hoursConfigured) {
    hoursValue = 'Open';
    hoursLabel  = `${todayHours.slot_1_from} – ${todayHours.slot_1_to}`;
    if (todayHours.slot_2_active && todayHours.slot_2_from) {
      hoursLabel += ` / ${todayHours.slot_2_from} – ${todayHours.slot_2_to}`;
    }
    hoursIsStatus = true;
  } else {
    hoursValue = '?'; hoursLabel = 'Hours not set'; hoursIsStatus = false;
  }

  const hubCards = [
    { ...H, value: hoursValue, label: hoursLabel, link: '/admin/restaurant', isStatus: hoursIsStatus },
    { ...H, value: openDaysThisWeek ?? '—', label: 'Open Days This Week', link: '/admin/restaurant' },
    { ...H, value: announcement?.is_active ? 'Live' : 'Off', label: 'Announcement', link: '/admin/restaurant', isStatus: announcement?.is_active },
  ];

  const gcCards = [
    { ...G, value: gcStats?.activeMembers   ?? 0, label: 'Active Members',    link: '/admin/gourmet-club/members' },
    { ...G, value: gcStats?.totalMembers    ?? 0, label: 'Total Members',      link: '/admin/gourmet-club/members' },
    { ...G, value: gcStats?.joinedThisMonth ?? 0, label: 'Joined This Month',  link: '/admin/gourmet-club'         },
  ];

  const active = [
    features.menu          ? 'menu' : null,
    features.restaurantHub ? 'hub'  : null,
    features.gourmetClub   ? 'gc'   : null,
  ].filter(Boolean);

  if (active.length === 0) return [];
  if (active.length === 3) return [menuCards[0], hubCards[0], gcCards[0]];
  if (active.length === 1) {
    if (features.menu)          return menuCards;
    if (features.restaurantHub) return hubCards;
    return gcCards;
  }
  // Two features
  if (features.menu && features.restaurantHub) return [menuCards[0], menuCards[1], hubCards[0]];
  if (features.menu && features.gourmetClub)   return [menuCards[0], menuCards[1], gcCards[0]];
  return [gcCards[0], gcCards[1], hubCards[0]]; // hub + gc
}

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
    const menuUrl = `${process.env.APP_URL || 'http://localhost:3000'}/menu`;
    const todayDay = DAYS[new Date().getDay()];
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [menuStats, qrDataUrl, recentItems, hubData, gcData] = await Promise.all([
      menuOn ? Promise.all([
        prisma.menuItem.count({ where: { is_available: true } }),
        prisma.category.count({ where: { parent_id: null } }),
        prisma.category.count({ where: { parent_id: { not: null } } }),
        prisma.setMenu.count(),
        prisma.menuItem.count({ where: { is_special: true } }),
        prisma.setMenu.count({ where: { is_available: true } }),
      ]) : Promise.resolve(null),
      menuOn ? QRCode.toDataURL(menuUrl, { width: 200, margin: 2, color: { dark: '#111827', light: '#ffffff' } }) : Promise.resolve(null),
      menuOn ? prisma.menuItem.findMany({
        take: 5,
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
      ]) : Promise.resolve(null),
    ]);

    const stats = menuStats ? {
      liveItems:          menuStats[0] + menuStats[5],
      totalCategories:    menuStats[1],
      totalSubCategories: menuStats[2],
      totalSetMenus:      menuStats[3],
      totalSpecials:      menuStats[4],
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
      activeMembers:   gcData[0],
      totalMembers:    gcData[1],
      joinedThisMonth: gcData[2],
      lastMember:      gcData[3],
    } : null;

    const cards = buildDashCards(res.locals.features, stats, todayHours, openDaysThisWeek, announcement, gcStats);

    res.render('admin/dashboard', {
      user: req.user,
      cards,
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

    const [categories, allergens, dietaryTags, allItems] = await Promise.all([
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
    ]);

    res.render('admin/builder', {
      user: req.user,
      categories,
      allergens,
      dietaryTags,
      allItems,
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
          categories: { include: { category: { include: { translations: true } } } },
          allergens:   { include: { allergen: { include: { translations: true } } } },
          dietary:     { include: { dietary_tag: { include: { translations: true } } } },
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
    const primary = res.locals.settings?.primary_language || 'en';
    const getName = (translations) => {
      const t = (translations || []).find(t => t.lang === primary) || (translations || [])[0];
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
      features: {
        restaurantHub: acc.has_restaurant_hub ?? false,
        gourmetClub:   acc.has_gourmet_club  ?? false,
      },
    });
  } catch (err) { next(err); }
});

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/profile', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true },
    });
    res.render('admin/profile', {
      user, current: 'profile',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
    });
  } catch (err) { next(err); }
});

// ── Gourmet Club ──────────────────────────────────────────────────────────────
router.get('/gourmet-club', async (req, res, next) => {
  if (!res.locals.features.gourmetClub) return res.redirect('/admin');
  try {
    const [totalMembers, activeMembers, consentCount] = await Promise.all([
      prisma.gourmetClubMember.count(),
      prisma.gourmetClubMember.count({ where: { is_active: true } }),
      prisma.gourmetClubMember.count({ where: { marketing_consent: true } }),
    ]);
    res.render('admin/gourmet-club/overview', {
      user: req.user, current: 'gourmet-club-dashboard',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
      stats: { totalMembers, activeMembers, consentCount },
    });
  } catch (err) { next(err); }
});

router.get('/gourmet-club/members', async (req, res, next) => {
  if (!res.locals.features.gourmetClub) return res.redirect('/admin');
  try {
    const members = await prisma.gourmetClubMember.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.render('admin/gourmet-club/members', {
      user: req.user, current: 'members',
      restaurantName: restaurantName(res),
      settings: res.locals.settings,
      members,
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
