// src/controllers/restaurant.js
// Handles RestaurantContact, OpeningHours, OpeningHoursOverride, Announcement

const prisma        = require('../config/database');
const { AppError }  = require('../utils/errors');

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

// ── Contact ───────────────────────────────────────────────────────────────────

async function getContact(req, res, next) {
  try {
    const contact = await prisma.restaurantContact.findFirst();
    res.json({ data: { contact } });
  } catch (err) { next(err); }
}

async function updateContact(req, res, next) {
  try {
    const fields = [
      'phone','whatsapp','email_general','email_reservations',
      'address','map_url',
      'instagram_url','facebook_url','tripadvisor_url','google_url',
      'twitter_url','linkedin_url','youtube_url',
    ];
    const data = {};
    fields.forEach(f => {
      if (req.body[f] !== undefined) data[f] = req.body[f] || null;
    });
    const contact = await prisma.restaurantContact.upsert({
      where: { id: 1 }, update: data, create: { id: 1, ...data },
    });
    res.json({ data: { contact } });
  } catch (err) { next(err); }
}

// ── Opening Hours ─────────────────────────────────────────────────────────────

async function getOpeningHours(req, res, next) {
  try {
    const hours = await prisma.openingHours.findMany({ orderBy: { id: 'asc' } });
    res.json({ data: { hours } });
  } catch (err) { next(err); }
}

async function updateOpeningHours(req, res, next) {
  try {
    const { hours } = req.body;
    if (!Array.isArray(hours)) throw new AppError('hours must be an array', 400);

    const updated = await Promise.all(
      hours.filter(h => DAYS.includes(h.day)).map(h =>
        prisma.openingHours.upsert({
          where:  { day: h.day },
          update: {
            is_closed:    Boolean(h.is_closed),
            slot_1_from:  h.slot_1_from  || null,
            slot_1_to:    h.slot_1_to    || null,
            slot_2_active: Boolean(h.slot_2_active),
            slot_2_from:  h.slot_2_from  || null,
            slot_2_to:    h.slot_2_to    || null,
            note:         h.note         || null,
          },
          create: {
            day:          h.day,
            is_closed:    Boolean(h.is_closed),
            slot_1_from:  h.slot_1_from  || null,
            slot_1_to:    h.slot_1_to    || null,
            slot_2_active: Boolean(h.slot_2_active),
            slot_2_from:  h.slot_2_from  || null,
            slot_2_to:    h.slot_2_to    || null,
            note:         h.note         || null,
          },
        })
      )
    );
    res.json({ data: { hours: updated } });
  } catch (err) { next(err); }
}

// ── Opening Hours Overrides ───────────────────────────────────────────────────

async function getOverrides(req, res, next) {
  try {
    const overrides = await prisma.openingHoursOverride.findMany({ orderBy: { date: 'asc' } });
    res.json({ data: { overrides } });
  } catch (err) { next(err); }
}

async function createOverride(req, res, next) {
  try {
    const { date, is_closed, slot_1_from, slot_1_to, slot_2_active, slot_2_from, slot_2_to, note } = req.body;
    if (!date) throw new AppError('date is required', 400);

    const override = await prisma.openingHoursOverride.create({
      data: {
        date:         new Date(date),
        is_closed:    is_closed !== false && is_closed !== 'false',
        slot_1_from:  slot_1_from  || null,
        slot_1_to:    slot_1_to    || null,
        slot_2_active: Boolean(slot_2_active),
        slot_2_from:  slot_2_from  || null,
        slot_2_to:    slot_2_to    || null,
        note:         note         || null,
      },
    });
    res.status(201).json({ data: { override } });
  } catch (err) {
    if (err.code === 'P2002') return next(new AppError('An override already exists for that date', 400));
    next(err);
  }
}

async function deleteOverride(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    await prisma.openingHoursOverride.delete({ where: { id } });
    res.json({ data: { message: 'Override deleted' } });
  } catch (err) { next(err); }
}

// ── Announcement ──────────────────────────────────────────────────────────────

async function getAnnouncement(req, res, next) {
  try {
    const announcement = await prisma.announcement.findFirst();
    res.json({ data: { announcement } });
  } catch (err) { next(err); }
}

async function updateAnnouncement(req, res, next) {
  try {
    const { title, body, cta_active, cta_label, cta_url, is_active } = req.body;
    const data = {};
    if (title      !== undefined) data.title      = title      || null;
    if (body       !== undefined) data.body        = body       || null;
    if (cta_label  !== undefined) data.cta_label   = cta_label  || null;
    if (cta_url    !== undefined) data.cta_url     = cta_url    || null;
    if (cta_active !== undefined) data.cta_active  = cta_active === true || cta_active === 'true';
    if (is_active  !== undefined) data.is_active   = is_active  === true || is_active  === 'true';
    if (req.uploadedFile)         data.image_url   = req.uploadedFile;

    const announcement = await prisma.announcement.upsert({
      where: { id: 1 }, update: data, create: { id: 1, ...data },
    });
    res.json({ data: { announcement } });
  } catch (err) { next(err); }
}

module.exports = {
  getContact, updateContact,
  getOpeningHours, updateOpeningHours,
  getOverrides, createOverride, deleteOverride,
  getAnnouncement, updateAnnouncement,
};
