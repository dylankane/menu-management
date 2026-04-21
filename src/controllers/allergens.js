// src/controllers/allergens.js

const prisma = require('../config/database');
const { AppError } = require('../utils/errors');
const { extractTranslations } = require('../utils/controllerHelpers');

const WITH_TRANSLATIONS = { translations: { orderBy: { lang: 'asc' } } };

// GET /api/allergens
async function list(req, res, next) {
  try {
    const allergens = await prisma.allergenTag.findMany({
      include: WITH_TRANSLATIONS,
      orderBy: { id: 'asc' },
    });
    res.json({ data: { allergens } });
  } catch (err) {
    next(err);
  }
}

// POST /api/allergens
async function create(req, res, next) {
  try {
    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];

    const translations = extractTranslations(req.body, langs, ['name'])
      .filter(t => t.name);

    const allergen = await prisma.allergenTag.create({
      data: {
        translations: { create: translations },
      },
      include: WITH_TRANSLATIONS,
    });

    res.status(201).json({ data: { allergen } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/allergens/:id
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.allergenTag.findUnique({ where: { id } });
    if (!existing) throw new AppError('Allergen not found', 404);

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];

    await prisma.$transaction(async (tx) => {
      const translations = extractTranslations(req.body, langs, ['name']);
      for (const t of translations) {
        if (t.name) {
          await tx.allergenTagTranslation.upsert({
            where: { allergen_id_lang: { allergen_id: id, lang: t.lang } },
            update: { name: t.name },
            create: { allergen_id: id, lang: t.lang, name: t.name },
          });
        }
      }
    });

    const allergen = await prisma.allergenTag.findUnique({
      where: { id },
      include: WITH_TRANSLATIONS,
    });
    res.json({ data: { allergen } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/allergens/:id
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.allergenTag.findUnique({ where: { id } });
    if (!existing) throw new AppError('Allergen not found', 404);
    await prisma.allergenTag.delete({ where: { id } });
    res.json({ data: { message: 'Allergen deleted' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
