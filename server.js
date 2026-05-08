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
        imgSrc:     ["'self'", 'data:', 'blob:'],
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
  res.status(404).send('Page not found');
});

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status  = err.status || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error('=== ERROR DETAILS ===');
    console.error('Message:', err.message);
    console.error('Stack:\n', err.stack);
    console.error('=====================');
  }

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({ error: message });
  }
  res.status(status).send(message);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[${process.env.RESTAURANT_NAME || 'Menu System'}] running on port ${PORT}`);
  console.log(`  Admin: ${process.env.APP_URL || `http://localhost:${PORT}`}/admin`);
  console.log(`  Menu:  ${process.env.APP_URL || `http://localhost:${PORT}`}/menu`);
});

module.exports = app;
