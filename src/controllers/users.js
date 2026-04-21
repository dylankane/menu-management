// src/controllers/users.js

const bcrypt       = require('bcryptjs');
const prisma       = require('../config/database');
const { AppError } = require('../utils/errors');

// GET /api/users/me
async function getMe(req, res, next) {
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

// PUT /api/users/me — update name and/or email
async function updateMe(req, res, next) {
  try {
    const { name, email } = req.body;

    // If changing email, make sure it's not already taken by another user
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, NOT: { id: req.user.id } },
      });
      if (existing) throw new AppError('Email already in use', 409);
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { ...(name && { name }), ...(email && { email }) },
      select: { id: true, email: true, name: true, role: true },
    });

    res.json({ data: { user } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/users/me/password
async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new AppError('User not found', 404);

    const match = await bcrypt.compare(current_password, user.password);
    if (!match) throw new AppError('Current password is incorrect', 401);

    const hashed = await bcrypt.hash(new_password, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    res.json({ data: { message: 'Password updated successfully' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateMe, changePassword };
