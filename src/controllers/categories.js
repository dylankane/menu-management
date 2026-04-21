// src/controllers/categories.js

const prisma = require('../config/database');
const { AppError } = require('../utils/errors');
const { extractTranslations, slugify } = require('../utils/controllerHelpers');

const WITH_TRANSLATIONS = {
  translations: { orderBy: { lang: 'asc' } },
};

// GET /api/categories
// Returns all top-level categories with their children nested inside.
async function list(req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      where: { parent_id: null },
      include: {
        ...WITH_TRANSLATIONS,
        children: {
          include: WITH_TRANSLATIONS,
          orderBy: { display_order: 'asc' },
        },
      },
      orderBy: { display_order: 'asc' },
    });
    res.json({ data: { categories } });
  } catch (err) {
    next(err);
  }
}

// GET /api/categories/flat
async function listFlat(req, res, next) {
  try {
    const categories = await prisma.category.findMany({
      include: WITH_TRANSLATIONS,
      orderBy: [{ parent_id: 'asc' }, { display_order: 'asc' }],
    });
    res.json({ data: { categories } });
  } catch (err) {
    next(err);
  }
}

// POST /api/categories
async function create(req, res, next) {
  try {
    const { parent_id, display_order, slug: rawSlug } = req.body;

    if (parent_id) {
      const parent = await prisma.category.findUnique({ where: { id: parseInt(parent_id) } });
      if (!parent) throw new AppError('Parent category not found', 404);
      if (parent.parent_id !== null) throw new AppError('Cannot nest more than one level deep', 400);
    }

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];
    const primary  = settings ? settings.primary_language : 'en';

    const translations = extractTranslations(req.body, langs, ['name', 'description']);

    console.log('DEBUG - Request body:', req.body);
    console.log('DEBUG - Extracted translations:', translations);
    console.log('DEBUG - Primary language:', primary);

    // Derive slug: use supplied slug, or auto-generate from primary language name
    const primaryTranslation = translations.find(t => t.lang === primary);
    const primaryName = primaryTranslation?.name || '';
    const slug = rawSlug ? slugify(rawSlug) : slugify(primaryName);
    if (!slug) throw new AppError('A name or slug is required to create a category', 400);

    const category = await prisma.category.create({
      data: {
        slug,
        parent_id:     parent_id ? parseInt(parent_id) : null,
        display_order: display_order ? parseInt(display_order) : 0,
        translations: {
          create: translations.filter(t => t.name || t.description),
        },
      },
      include: { ...WITH_TRANSLATIONS, children: { include: WITH_TRANSLATIONS } },
    });

    res.status(201).json({ data: { category } });
  } catch (err) {
    console.log('DEBUG - Error caught:', err.message);
    console.log('DEBUG - Error stack:', err.stack);
    if (err.code === 'P2002') return next(new AppError('A category with that slug already exists', 409));
    next(err);
  }
}

// PUT /api/categories/:id
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { display_order, is_active, slug: rawSlug } = req.body;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new AppError('Category not found', 404);

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];

    const scalarData = {};
    if (display_order !== undefined) scalarData.display_order = parseInt(display_order);
    if (is_active     !== undefined) scalarData.is_active     = is_active === 'true' || is_active === true;
    if (rawSlug)                     scalarData.slug           = slugify(rawSlug);

    await prisma.$transaction(async (tx) => {
      if (Object.keys(scalarData).length) {
        await tx.category.update({ where: { id }, data: scalarData });
      }

      const translations = extractTranslations(req.body, langs, ['name', 'description']);
      for (const t of translations) {
        if (t.name !== undefined || t.description !== undefined) {
          await tx.categoryTranslation.upsert({
            where: { category_id_lang: { category_id: id, lang: t.lang } },
            update: { name: t.name, description: t.description },
            create: { category_id: id, lang: t.lang, name: t.name, description: t.description },
          });
        }
      }
    });

    const category = await prisma.category.findUnique({
      where: { id },
      include: { ...WITH_TRANSLATIONS, children: { include: WITH_TRANSLATIONS } },
    });
    res.json({ data: { category } });
  } catch (err) {
    if (err.code === 'P2002') return next(new AppError('A category with that slug already exists', 409));
    next(err);
  }
}

// DELETE /api/categories/:id
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });
    if (!existing) throw new AppError('Category not found', 404);
    if (existing.is_protected) throw new AppError('This category is protected and cannot be deleted', 403);
    if (existing.children.length > 0) throw new AppError('Delete or move all subcategories first', 400);

    await prisma.category.delete({ where: { id } });
    res.json({ data: { message: 'Category deleted' } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/categories/reorder
async function reorder(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      throw new AppError('items must be a non-empty array', 400);
    }

    await prisma.$transaction(
      items.map(({ id, display_order }) =>
        prisma.category.update({
          where: { id: parseInt(id) },
          data: { display_order: parseInt(display_order) },
        })
      )
    );

    res.json({ data: { message: 'Order updated' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listFlat, create, update, remove, reorder };
