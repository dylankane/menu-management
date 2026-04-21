// src/controllers/auth.js

const bcrypt       = require('bcryptjs');
const prisma       = require('../config/database');
const { signToken } = require('../utils/jwt');
const { AppError } = require('../utils/errors');

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.is_active) {
      throw new AppError('Invalid email or password', 401);
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    // Store token in an httpOnly cookie — not accessible to JavaScript,
    // which protects against XSS attacks.
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
    });

    res.json({
      data: {
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
function logout(req, res) {
  res.clearCookie('token');
  res.json({ data: { message: 'Logged out successfully' } });
}

// GET /api/auth/me
async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true, role: true, created_at: true },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json({ data: { user } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me };
