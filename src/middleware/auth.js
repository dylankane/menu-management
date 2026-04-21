// src/middleware/auth.js
// Reads the JWT from an httpOnly cookie (set at login).
// Falls back to the Authorization: Bearer header for API clients.
// Attaches the decoded user payload to req.user.

const { verifyToken } = require('../utils/jwt');
const { AppError }    = require('../utils/errors');

function requireAuth(req, res, next) {
  try {
    // 1. Try cookie first (browser / admin dashboard)
    let token = req.cookies?.token;

    // 2. Fall back to Authorization header (API / programmatic access)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      // API requests get a JSON 401; page requests get redirected to login
      if (req.path.startsWith('/api/')) {
        throw new AppError('Authentication required', 401);
      }
      return res.redirect('/admin/login');
    }

    req.user = verifyToken(token);
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      // Clear the stale cookie
      res.clearCookie('token');
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Session expired, please log in again' });
      }
      return res.redirect('/admin/login');
    }
    next(err);
  }
}

module.exports = { requireAuth };
