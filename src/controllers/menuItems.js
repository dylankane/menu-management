// src/controllers/menuItems.js
// CRUD for regular menu items (dishes). is_set_menu = false.

const prisma = require('../config/database');
const { AppError } = require('../utils/errors');
const { parseBool, parseIds, extractTranslations } = require('../utils/controllerHelpers');

const FULL_INCLUDE = {
  translations: true,
  categories: {
    include: { category: { include: { translations: true } } },
    orderBy: { display_order: 'asc' },
  },
  allergens: { include: { allergen: { include: { translations: true } } } },
  dietary:   { include: { dietary_tag: { include: { translations: true } } } },
};

// GET /api/menu-items
async function list(req, res, next) {
  try {
    const { category_id, available, special } = req.query;

    const where = { is_set_menu: false };
    if (available !== undefined) where.is_available = available === 'true';
    if (special   !== undefined) where.is_special   = special   === 'true';
    if (category_id) {
      where.categories = { some: { category_id: parseInt(category_id) } };
    }

    const items = await prisma.menuItem.findMany({
      where,
      include: FULL_INCLUDE,
      orderBy: { created_at: 'desc' },
    });

    res.json({ data: { items } });
  } catch (err) {
    next(err);
  }
}

// GET /api/menu-items/:id
async function getOne(req, res, next) {
  try {
    const id   = parseInt(req.params.id);
    const item = await prisma.menuItem.findFirst({
      where: { id, is_set_menu: false },
      include: FULL_INCLUDE,
    });
    if (!item) throw new AppError('Menu item not found', 404);
    res.json({ data: { item } });
  } catch (err) {
    next(err);
  }
}

// POST /api/menu-items
async function create(req, res, next) {
  try {
    const {
      price,
      has_discount, discount_type, discount_value,
      is_available, is_special,
      category_ids, allergen_ids, dietary_ids,
    } = req.body;

    // Determine which languages to save translations for
    const settings = await prisma.restaurantSettings.findFirst();
    const langs = settings ? (settings.enabled_languages) : ['en', 'es'];

    const translations = extractTranslations(req.body, langs, ['name', 'description']);

    const item = await prisma.menuItem.create({
      data: {
        price:          parseFloat(price),
        image_url:      req.uploadedFile || null,
        has_discount:   parseBool(has_discount),
        discount_type:  discount_type || null,
        discount_value: discount_value ? parseFloat(discount_value) : null,
        is_available:   parseBool(is_available, true),
        is_special:     parseBool(is_special, false),
        is_set_menu:    false,
        notes:          req.body.notes || null,
        translations: {
          create: translations.filter(t => t.name || t.description),
        },
        categories: parseIds(category_ids).length
          ? { create: parseIds(category_ids).map((cid, i) => ({ category_id: cid, display_order: i })) }
          : undefined,
        allergens: parseIds(allergen_ids).length
          ? { create: parseIds(allergen_ids).map(id => ({ allergen_id: id })) }
          : undefined,
        dietary: parseIds(dietary_ids).length
          ? { create: parseIds(dietary_ids).map(id => ({ dietary_id: id })) }
          : undefined,
      },
      include: FULL_INCLUDE,
    });

    res.status(201).json({ data: { item } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/menu-items/:id
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.menuItem.findFirst({ where: { id, is_set_menu: false } });
    if (!existing) throw new AppError('Menu item not found', 404);

    const {
      price,
      has_discount, discount_type, discount_value,
      is_available, is_special,
      category_ids, allergen_ids, dietary_ids,
    } = req.body;

    const scalarData = {};
    if (price          !== undefined) scalarData.price          = parseFloat(price);
    if (discount_type  !== undefined) scalarData.discount_type  = discount_type || null;
    if (discount_value !== undefined) scalarData.discount_value = discount_value ? parseFloat(discount_value) : null;
    if (req.uploadedFile)             scalarData.image_url      = req.uploadedFile;

    // When a full form is submitted, treat absent checkboxes as false
    const formSubmit = price !== undefined;
    if (has_discount !== undefined || formSubmit) scalarData.has_discount = parseBool(has_discount);
    if (is_available !== undefined || formSubmit) scalarData.is_available = parseBool(is_available);
    if (is_special   !== undefined || formSubmit) scalarData.is_special   = parseBool(is_special);
    if (req.body.notes !== undefined) scalarData.notes = req.body.notes || null;

    // Determine languages for translation upsert
    const settings = await prisma.restaurantSettings.findFirst();
    const langs = settings ? (settings.enabled_languages) : ['en', 'es'];

    await prisma.$transaction(async (tx) => {
      await tx.menuItem.update({ where: { id }, data: scalarData });

      // Translations — upsert each language
      const translations = extractTranslations(req.body, langs, ['name', 'description']);
      for (const t of translations) {
        if (t.name !== undefined || t.description !== undefined) {
          await tx.menuItemTranslation.upsert({
            where: { menu_item_id_lang: { menu_item_id: id, lang: t.lang } },
            update: { name: t.name, description: t.description },
            create: { menu_item_id: id, lang: t.lang, name: t.name, description: t.description },
          });
        }
      }

      if (category_ids !== undefined) {
        await tx.menuItemCategory.deleteMany({ where: { menu_item_id: id } });
        if (parseIds(category_ids).length) {
          await tx.menuItemCategory.createMany({
            data: parseIds(category_ids).map((cid, i) => ({
              menu_item_id: id, category_id: cid, display_order: i,
            })),
          });
        }
      }

      if (allergen_ids !== undefined) {
        await tx.menuItemAllergen.deleteMany({ where: { menu_item_id: id } });
        if (parseIds(allergen_ids).length) {
          await tx.menuItemAllergen.createMany({
            data: parseIds(allergen_ids).map(aid => ({ menu_item_id: id, allergen_id: aid })),
          });
        }
      }

      if (dietary_ids !== undefined) {
        await tx.menuItemDietary.deleteMany({ where: { menu_item_id: id } });
        if (parseIds(dietary_ids).length) {
          await tx.menuItemDietary.createMany({
            data: parseIds(dietary_ids).map(did => ({ menu_item_id: id, dietary_id: did })),
          });
        }
      }
    });

    const item = await prisma.menuItem.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.json({ data: { item } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/menu-items/:id
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.menuItem.findFirst({ where: { id, is_set_menu: false } });
    if (!existing) throw new AppError('Menu item not found', 404);
    await prisma.menuItem.delete({ where: { id } });
    res.json({ data: { message: 'Menu item deleted' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
