// server.js — Entry point for the Restaurant Menu Management System
// This single Express app serves both the admin dashboard (/admin)
// and the customer-facing menu (/menu) to avoid CORS/auth headaches.

require('dotenv').config();

const express    = require('express');
const path       = require('path');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc:     ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:', 'blob:', 'https:'],
        frameSrc:        ["'self'", "https://www.google.com", "https://maps.google.com"],
        frameAncestors:  ["'self'"],
      },
    },
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  })
);

// ── General API rate limiting ─────────────────────────────────────────────────
// Applied to all /api routes. The login route has its own stricter limit.
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '100',   10),
  message:  { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Template engine ───────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api',              apiLimiter);
app.use('/api/auth',         require('./src/routes/auth'));
app.use('/api/users',        require('./src/routes/users'));
app.use('/api/categories',   require('./src/routes/categories'));
app.use('/api/menu-items',   require('./src/routes/menuItems'));
app.use('/api/set-menus',    require('./src/routes/setMenus'));
app.use('/api/allergens',    require('./src/routes/allergens'));
app.use('/api/dietary',      require('./src/routes/dietary'));
app.use('/api/courses',      require('./src/routes/courses'));
app.use('/api/settings',       require('./src/routes/restaurantSettings'));
app.use('/api/client-account', require('./src/routes/clientAccount'));
app.use('/api/restaurant',     require('./src/routes/restaurant'));
app.use('/api/super-admin',    require('./src/routes/superAdmin'));
app.use('/api/gourmet-club',        require('./src/routes/gourmetClub'));
app.use('/api/static-translations', require('./src/routes/staticTranslations'));

// ── Admin page routes ─────────────────────────────────────────────────────────
app.use('/admin', require('./src/routes/adminPages'));

// ── Public menu page ──────────────────────────────────────────────────────────
app.use('/menu', require('./src/routes/menuPages'));

// Root redirect
app.get('/', (req, res) => res.redirect('/admin'));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  const isAdmin = req.path.startsWith('/admin');
  res.status(404).render('shared/404', {
    restaurantName: process.env.RESTAURANT_NAME || 'Restaurant',
    returnUrl:      isAdmin ? '/admin' : '/menu',
    returnLabel:    isAdmin ? 'Back to Dashboard' : 'Back to Menu',
  });
});

// ── Prisma error sanitiser ────────────────────────────────────────────────────
// Maps Prisma client error codes to human-readable messages.
// Raw Prisma messages must never reach the client.
function sanitiseError(err) {
  const code = err.code; // Prisma errors carry a .code property
  if (code) {
    switch (code) {
      case 'P2002': return 'That record already exists — please use a unique value.';
      case 'P2025': return 'Record not found.';
      case 'P2003': return 'This action is not allowed because other records depend on it.';
      case 'P2014': return 'This change would break a required relationship between records.';
      case 'P2000': return 'One of the values provided is too long for this field.';
      default:      return 'Something went wrong — please try again.';
    }
  }
  // AppError messages are intentionally user-facing — pass them through
  if (err.name === 'AppError') return err.message;
  // Any other server error — return generic message
  if (!err.status || err.status >= 500) return 'Something went wrong — please try again.';
  // 4xx errors with explicit messages (validation etc.) — pass through
  return err.message || 'Something went wrong.';
}

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status  = err.status || 500;
  const message = sanitiseError(err);

  if (status >= 500) {
    console.error('=== ERROR DETAILS ===');
    console.error('Message:', err.message);
    console.error('Stack:\n', err.stack);
    console.error('=====================');
  }

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: message });
  }

  const isAdmin = req.path.startsWith('/admin');
  const viewData = {
    restaurantName: process.env.RESTAURANT_NAME || 'Restaurant',
    returnUrl:      isAdmin ? '/admin' : '/menu',
    returnLabel:    isAdmin ? 'Back to Dashboard' : 'Back to Menu',
  };

  const view = status === 403 ? 'shared/403' : 'shared/500';
  res.status(status).render(view, viewData);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const { syncStaticTranslations } = require('./src/helpers/staticTextSync');

app.listen(PORT, () => {
  console.log(`[${process.env.RESTAURANT_NAME || 'Menu System'}] running on port ${PORT}`);
  console.log(`  Admin: ${process.env.APP_URL || `http://localhost:${PORT}`}/admin`);
  console.log(`  Menu:  ${process.env.APP_URL || `http://localhost:${PORT}`}/menu`);
  syncStaticTranslations().catch(err => console.error('[i18n] Static sync error:', err.message));
});

module.exports = app;
