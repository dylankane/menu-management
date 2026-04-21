// src/controllers/dietary.js

const prisma = require('../config/database');
const { AppError } = require('../utils/errors');
const { extractTranslations } = require('../utils/controllerHelpers');

const WITH_TRANSLATIONS = { translations: { orderBy: { lang: 'asc' } } };

// GET /api/dietary
async function list(req, res, next) {
  try {
    const tags = await prisma.dietaryTag.findMany({
      include: WITH_TRANSLATIONS,
      orderBy: { id: 'asc' },
    });
    res.json({ data: { tags } });
  } catch (err) {
    next(err);
  }
}

// POST /api/dietary
async function create(req, res, next) {
  try {
    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];

    const translations = extractTranslations(req.body, langs, ['name'])
      .filter(t => t.name);

    const tag = await prisma.dietaryTag.create({
      data: {
        translations: { create: translations },
      },
      include: WITH_TRANSLATIONS,
    });

    res.status(201).json({ data: { tag } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/dietary/:id
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.dietaryTag.findUnique({ where: { id } });
    if (!existing) throw new AppError('Dietary tag not found', 404);

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];

    await prisma.$transaction(async (tx) => {
      const translations = extractTranslations(req.body, langs, ['name']);
      for (const t of translations) {
        if (t.name) {
          await tx.dietaryTagTranslation.upsert({
            where: { dietary_id_lang: { dietary_id: id, lang: t.lang } },
            update: { name: t.name },
            create: { dietary_id: id, lang: t.lang, name: t.name },
          });
        }
      }
    });

    const tag = await prisma.dietaryTag.findUnique({
      where: { id },
      include: WITH_TRANSLATIONS,
    });
    res.json({ data: { tag } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/dietary/:id
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.dietaryTag.findUnique({ where: { id } });
    if (!existing) throw new AppError('Dietary tag not found', 404);
    await prisma.dietaryTag.delete({ where: { id } });
    res.json({ data: { message: 'Dietary tag deleted' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
