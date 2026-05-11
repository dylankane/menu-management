const express         = require('express');
const prisma          = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { upload }      = require('../middleware/upload');

const router = express.Router();

// ── Public Sign-up Endpoint (no auth) ────────────────────────────────────────
router.post('/join', async (req, res, next) => {
  try {
    const { name, email, phone, marketing_consent } = req.body;
    
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    if (!email?.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    if (!marketing_consent) {
      return res.status(400).json({ message: 'Marketing consent is required to join' });
    }

    const member = await prisma.gourmetClubMember.create({
      data: {
        name:              name.trim(),
        email:             email.trim(),
        phone:             phone?.trim() || null,
        marketing_consent: true,
        source:            'qr_menu',
        is_active:         true,
      },
    });

    res.status(201).json({ 
      success: true,
      message: 'Welcome to the Gourmet Club!',
      data: { member: { id: member.id, name: member.name } }
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ message: 'This email is already registered' });
    }
    next(err);
  }
});

// ── Protected Routes (require auth) ───────────────────────────────────────────
router.use(requireAuth);

// ── Members ───────────────────────────────────────────────────────────────────

router.get('/members', async (req, res, next) => {
  try {
    const members = await prisma.gourmetClubMember.findMany({
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { visits: true } } },
    });
    res.json({ data: { members } });
  } catch (err) { next(err); }
});

router.post('/members', async (req, res, next) => {
  try {
    const { name, email, phone, birthday_month, birthday_day, notes, marketing_consent, source } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const member = await prisma.gourmetClubMember.create({
      data: {
        name:              name.trim(),
        email:             email?.trim()  || null,
        phone:             phone?.trim()  || null,
        birthday_month:    birthday_month ? parseInt(birthday_month, 10) : null,
        birthday_day:      birthday_day   ? parseInt(birthday_day,   10) : null,
        notes:             notes?.trim()  || null,
        marketing_consent: Boolean(marketing_consent),
        source:            source || 'admin',
      },
    });
    res.status(201).json({ data: { member } });
  } catch (err) { next(err); }
});

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

router.delete('/members/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.gourmetClubMember.delete({ where: { id } });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

// ── Member CSV export ─────────────────────────────────────────────────────────

router.get('/members/export', async (req, res, next) => {
  try {
    const members = await prisma.gourmetClubMember.findMany({
      where: { is_active: true, marketing_consent: true },
      orderBy: { name: 'asc' },
    });
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const header = ['Name','Email','Phone','Member #','Joined','Birthday'].map(esc).join(',');
    const rows = members.map(m => {
      const birthday = (m.birthday_month && m.birthday_day)
        ? `${MONTHS[m.birthday_month - 1]} ${m.birthday_day}` : '';
      return [
        esc(m.name),
        esc(m.email),
        esc(m.phone),
        esc(`GC-${String(m.id).padStart(3, '0')}`),
        esc(new Date(m.created_at).toLocaleDateString('en-GB')),
        esc(birthday),
      ].join(',');
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gourmet-club-members.csv"');
    res.send([header, ...rows].join('\r\n'));
  } catch (err) { next(err); }
});

// ── Member visits ─────────────────────────────────────────────────────────────

router.get('/members/:id/visits', async (req, res, next) => {
  try {
    const member_id = parseInt(req.params.id, 10);
    const visits = await prisma.memberVisit.findMany({
      where: { member_id },
      orderBy: { date: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });
    res.json({ data: { visits } });
  } catch (err) { next(err); }
});

router.post('/members/:id/visits', async (req, res, next) => {
  try {
    const member_id = parseInt(req.params.id, 10);
    const { date, notes, source } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });
    const visit = await prisma.memberVisit.create({
      data: {
        member_id,
        date:     new Date(date),
        notes:    notes?.trim() || null,
        source:   source || 'manual',
        added_by: req.user.id,
      },
      include: { user: { select: { id: true, name: true } } },
    });
    res.status(201).json({ data: { visit } });
  } catch (err) { next(err); }
});

router.delete('/visits/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.memberVisit.delete({ where: { id } });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

// ── Paper Form ────────────────────────────────────────────────────────────────

router.post('/paper-form/:side', upload('image', 'paper-forms'), async (req, res, next) => {
  try {
    const { side } = req.params;
    if (side !== 'front' && side !== 'back') return res.status(400).json({ error: 'Side must be front or back' });
    if (!req.uploadedFile) return res.status(400).json({ error: 'No file uploaded' });
    const field = side === 'front' ? 'gc_paper_form_front_url' : 'gc_paper_form_back_url';
    await prisma.clientAccount.upsert({
      where:  { id: 1 },
      update: { [field]: req.uploadedFile },
      create: { id: 1, [field]: req.uploadedFile },
    });
    res.json({ data: { url: req.uploadedFile } });
  } catch (err) { next(err); }
});

router.delete('/paper-form/:side', async (req, res, next) => {
  try {
    const { side } = req.params;
    if (side !== 'front' && side !== 'back') return res.status(400).json({ error: 'Side must be front or back' });
    const field = side === 'front' ? 'gc_paper_form_front_url' : 'gc_paper_form_back_url';
    await prisma.clientAccount.upsert({
      where:  { id: 1 },
      update: { [field]: null },
      create: { id: 1 },
    });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

// ── Raffles ───────────────────────────────────────────────────────────────────

router.get('/raffles', async (req, res, next) => {
  try {
    const raffles = await prisma.raffle.findMany({
      orderBy: { created_at: 'desc' },
      include: { winner: { select: { id: true, name: true, email: true } } },
    });
    res.json({ data: { raffles } });
  } catch (err) { next(err); }
});

router.post('/raffles', upload('image', 'raffles'), async (req, res, next) => {
  try {
    const { title, description, prize, prize_description, eligibility, start_date, end_date, draw_date, notes } = req.body;
    if (!title?.trim())  return res.status(400).json({ error: 'Title is required' });
    if (!prize?.trim())  return res.status(400).json({ error: 'Prize is required' });
    if (!start_date)     return res.status(400).json({ error: 'Start date is required' });
    if (!end_date)       return res.status(400).json({ error: 'End date is required' });

    const hasActive = await prisma.raffle.findFirst({ where: { status: 'active' } });

    const raffle = await prisma.raffle.create({
      data: {
        title:             title.trim(),
        description:       description?.trim()       || null,
        prize:             prize.trim(),
        prize_description: prize_description?.trim() || null,
        image_url:         req.uploadedFile          || null,
        period_type:       'custom',
        eligibility:       eligibility || 'all',
        start_date:        new Date(start_date),
        end_date:          new Date(end_date),
        draw_date:         draw_date ? new Date(draw_date) : null,
        notes:             notes?.trim() || null,
        status:            hasActive ? 'inactive' : 'active',
      },
    });
    res.status(201).json({ data: { raffle } });
  } catch (err) { next(err); }
});

router.put('/raffles/:id', upload('image', 'raffles'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.raffle.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Raffle not found' });
    if (existing.status === 'drawn') return res.status(400).json({ error: 'Cannot edit a completed raffle' });

    const { title, description, prize, prize_description, period_type, eligibility, start_date, end_date, draw_date, notes, status } = req.body;

    if (status === 'active') {
      await prisma.raffle.updateMany({
        where: { status: 'active', id: { not: id } },
        data:  { status: 'inactive' },
      });
    }

    const raffle = await prisma.raffle.update({
      where: { id },
      data: {
        ...(title             !== undefined && { title: title.trim() }),
        ...(description       !== undefined && { description: description?.trim() || null }),
        ...(prize             !== undefined && { prize: prize.trim() }),
        ...(prize_description !== undefined && { prize_description: prize_description?.trim() || null }),
        ...(req.uploadedFile  !== undefined && { image_url: req.uploadedFile }),
        ...(period_type !== undefined && { period_type }),
        ...(eligibility !== undefined && { eligibility }),
        ...(start_date  !== undefined && { start_date: new Date(start_date) }),
        ...(end_date    !== undefined && { end_date: new Date(end_date) }),
        ...(draw_date   !== undefined && { draw_date: draw_date ? new Date(draw_date) : null }),
        ...(notes       !== undefined && { notes: notes?.trim() || null }),
        ...(status      !== undefined && status !== 'drawn' && { status }),
      },
    });
    res.json({ data: { raffle } });
  } catch (err) { next(err); }
});

// ── Draw ──────────────────────────────────────────────────────────────────────

router.post('/raffles/:id/draw', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const raffle = await prisma.raffle.findUnique({ where: { id } });
    if (!raffle)                     return res.status(404).json({ error: 'Raffle not found' });
    if (raffle.status !== 'active')  return res.status(400).json({ error: 'Raffle is not active' });

    const eligible = await prisma.gourmetClubMember.findMany({
      where: {
        is_active: true,
        ...(raffle.eligibility === 'new' && {
          created_at: { gte: raffle.start_date, lte: raffle.end_date },
        }),
      },
      select: { id: true },
    });

    if (eligible.length === 0) {
      return res.status(400).json({ error: 'No eligible members for this raffle' });
    }

    const winner = eligible[Math.floor(Math.random() * eligible.length)];

    const updated = await prisma.raffle.update({
      where: { id },
      data: { winner_id: winner.id, status: 'drawn', drawn_at: new Date() },
      include: { winner: { select: { id: true, name: true, email: true } } },
    });

    res.json({ data: { raffle: updated } });
  } catch (err) { next(err); }
});

// ── Delete raffle ─────────────────────────────────────────────────────────────

router.delete('/raffles/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await prisma.raffle.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Raffle not found' });
    if (existing.status === 'drawn') return res.status(400).json({ error: 'Cannot delete a completed raffle' });
    await prisma.raffle.delete({ where: { id } });
    res.json({ data: { ok: true } });
  } catch (err) { next(err); }
});

module.exports = router;
