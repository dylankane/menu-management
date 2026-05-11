// src/controllers/users.js

const bcrypt       = require('bcryptjs');
const prisma       = require('../config/database');
const { AppError } = require('../utils/errors');

// GET /api/users
async function listUsers(req, res, next) {
  try {
    const where = req.user.role === 'super_admin' ? {} : { role: { not: 'super_admin' } };
    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, is_active: true, created_at: true },
      orderBy: { created_at: 'asc' },
    });
    res.json({ data: { users } });
  } catch (err) {
    next(err);
  }
}

// POST /api/users
async function createUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('A user with that email already exists', 409);

    // Only a super_admin can create another super_admin
    const assignedRole = (req.user.role === 'super_admin' && role === 'super_admin') ? 'super_admin' : 'admin';

    const hashed = await bcrypt.hash(password, 12);
    const user   = await prisma.user.create({
      data: { name, email, password: hashed, role: assignedRole, is_active: true },
      select: { id: true, email: true, name: true, role: true, created_at: true },
    });
    res.status(201).json({ data: { user } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/:id
async function deleteUser(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);

    if (id === req.user.id) throw new AppError('You cannot delete your own account', 400);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new AppError('User not found', 404);

    if (target.role === 'super_admin' && req.user.role !== 'super_admin') {
      throw new AppError('Access denied', 403);
    }

    await prisma.user.delete({ where: { id } });
    res.json({ data: { message: 'User deleted' } });
  } catch (err) {
    next(err);
  }
}

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

module.exports = { getMe, updateMe, changePassword, listUsers, createUser, deleteUser };
