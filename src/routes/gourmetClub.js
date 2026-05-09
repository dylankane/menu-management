const express         = require('express');
const prisma          = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ── List members ──────────────────────────────────────────────────────────────
router.get('/members', async (req, res, next) => {
  try {
    const members = await prisma.gourmetClubMember.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.json({ data: { members } });
  } catch (err) { next(err); }
});

// ── Create member ─────────────────────────────────────────────────────────────
router.post('/members', async (req, res, next) => {
  try {
    const { name, email, phone, birthday_month, birthday_day, notes, marketing_consent } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const member = await prisma.gourmetClubMember.create({
      data: {
        name:              name.trim(),
        email:             email?.trim()  || null,
        phone:             phone?.trim()  || null,
        birthday_month:    birthday_month ? parseInt(birthday_month, 10) : null,
        birthday_day:      birthday_day   ? parseInt(birthday_day,   10) : null,
        notes:             notes?.trim()  || null,
        marketing_consent: Boolean(marketing_consent),
      },
    });
    res.status(201).json({ data: { member } });
  } catch (err) { next(err); }
});

// ── Update member ─────────────────────────────────────────────────────────────
router.put('/members/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, email, phone, birthday_month, birthday_day, notes, marketing_consent, is_active } = req.body;
    const member = await prisma.gourmetClubMember.update({
      where: { id },
      data: {
        ...(name              !== undefined && { name: name.trim() }),
        ...(email             !== undefined && { email: email?.trim() || null }),
        ...(phone             !== undefined && { phone: phone?.trim() || null }),
        ...(birthday_month    !== undefined && { birthday_month: birthday_month ? parseInt(birthday_month, 10) : null }),
        ...(birthday_day      !== undefined && { birthday_day:   birthday_day   ? parseInt(birthday_day,   10) : null }),
        ...(notes             !== undefined && { notes: notes?.trim() || null }),
        ...(marketing_consent !== undefined && { marketing_consent: Boolean(marketing_consent) }),
        ...(is_active         !== undefined && { is_active: Boolean(is_active) }),
      },
    });
    res.json({ data: { member } });
  } catch (err) { next(err); }
});

// ── Delete member ─────────────────────────────────────────────────────────────
router.delete('/members/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.gourmetClubMember.delete({ where: { id } });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

module.exports = router;
