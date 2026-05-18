// src/controllers/menuItems.js
// CRUD for regular menu items (dishes).

const prisma = require('../config/database');
const { AppError } = require('../utils/errors');
const { parseBool, parseIds, extractTranslations } = require('../utils/controllerHelpers');

const FULL_INCLUDE = {
  translations: true,
  categories: {
    include: { category: { include: { translations: true } } },
    orderBy: { display_order: 'asc' },
  },
  allergens:       { include: { allergen:    { include: { translations: true } } } },
  dietary:         { include: { dietary_tag: { include: { translations: true } } } },
  set_menu_dishes: { include: { set_menu:    { include: { translations: true } } } },
};

// GET /api/menu-items
async function list(req, res, next) {
  try {
    const { category_id, available, special } = req.query;

    const where = {};
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
    const item = await prisma.menuItem.findUnique({
      where: { id },
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

    const translations = extractTranslations(req.body, langs, ['name', 'description', 'public_notes', 'price_note']);

    const item = await prisma.menuItem.create({
      data: {
        price:          (price !== '' && price != null) ? parseFloat(price) : null,
        image_url:      req.uploadedFile || null,
        has_discount:   parseBool(has_discount),
        discount_type:  discount_type || null,
        discount_value: discount_value ? parseFloat(discount_value) : null,
        is_available:   parseBool(is_available, true),
        is_special:     parseBool(is_special, false),
        notes:          req.body.notes || null,
        translations: {
          create: translations.filter(t => t.name || t.description || t.price_note),
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

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) throw new AppError('Menu item not found', 404);

    const {
      price,
      has_discount, discount_type, discount_value,
      is_available, is_special,
      category_ids, allergen_ids, dietary_ids,
    } = req.body;

    const scalarData = {};
    if (price          !== undefined) scalarData.price          = (price !== '' && price != null) ? parseFloat(price) : null;
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
      const translations = extractTranslations(req.body, langs, ['name', 'description', 'public_notes', 'price_note']);
      for (const t of translations) {
        if (t.name !== undefined || t.description !== undefined || t.public_notes !== undefined || t.price_note !== undefined) {
          await tx.menuItemTranslation.upsert({
            where:  { menu_item_id_lang: { menu_item_id: id, lang: t.lang } },
            update: { name: t.name, description: t.description, public_notes: t.public_notes, price_note: t.price_note },
            create: { menu_item_id: id, lang: t.lang, name: t.name, description: t.description, public_notes: t.public_notes, price_note: t.price_note },
          });
        }
      }

      if (category_ids !== undefined || formSubmit) {
        const newIds      = category_ids !== undefined ? parseIds(category_ids) : [];
        const existing    = await tx.menuItemCategory.findMany({
          where:  { menu_item_id: id },
          select: { category_id: true },
        });
        const existingIds = existing.map(e => e.category_id);
        const toRemove    = existingIds.filter(cid => !newIds.includes(cid));
        const toAdd       = newIds.filter(cid => !existingIds.includes(cid));

        if (toRemove.length) {
          await tx.menuItemCategory.deleteMany({
            where: { menu_item_id: id, category_id: { in: toRemove } },
          });
        }
        for (const cid of toAdd) {
          const { _max } = await tx.menuItemCategory.aggregate({
            where: { category_id: cid },
            _max:  { display_order: true },
          });
          await tx.menuItemCategory.create({
            data: { menu_item_id: id, category_id: cid, display_order: (_max.display_order ?? -1) + 1 },
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
    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) throw new AppError('Menu item not found', 404);
    await prisma.menuItem.delete({ where: { id } });
    res.json({ data: { message: 'Menu item deleted' } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/menu-items/reorder
// Reorders dishes within a single category by updating MenuItemCategory.display_order.
// Body: { category_id, items: [{ menu_item_id, display_order }] }
async function reorderInCategory(req, res, next) {
  try {
    const { category_id, items } = req.body;
    if (!category_id || !Array.isArray(items) || items.length === 0) {
      throw new AppError('category_id and items array are required', 400);
    }
    await prisma.$transaction(
      items.map(({ menu_item_id, display_order }) =>
        prisma.menuItemCategory.update({
          where: {
            menu_item_id_category_id: {
              menu_item_id: parseInt(menu_item_id),
              category_id:  parseInt(category_id),
            },
          },
          data: { display_order: parseInt(display_order) },
        })
      )
    );
    res.json({ data: { message: 'Order updated' } });
  } catch (err) { next(err); }
}

// PATCH /api/menu-items/:id/move
// Moves a dish from one category to another.
// Body: { from_category_id, to_category_id }
async function moveToCategory(req, res, next) {
  try {
    const id               = parseInt(req.params.id);
    const from_category_id = parseInt(req.body.from_category_id);
    const to_category_id   = parseInt(req.body.to_category_id);

    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new AppError('Menu item not found', 404);

    const maxOrder = await prisma.menuItemCategory.aggregate({
      where: { category_id: to_category_id },
      _max:  { display_order: true },
    });

    await prisma.$transaction([
      prisma.menuItemCategory.delete({
        where: {
          menu_item_id_category_id: {
            menu_item_id: id,
            category_id:  from_category_id,
          },
        },
      }),
      prisma.menuItemCategory.create({
        data: {
          menu_item_id:  id,
          category_id:   to_category_id,
          display_order: (maxOrder._max.display_order ?? -1) + 1,
        },
      }),
    ]);

    res.json({ data: { message: 'Dish moved' } });
  } catch (err) {
    if (err.code === 'P2002') return next(new AppError('That item is already in this category', 409));
    next(err);
  }
}

// DELETE /api/menu-items/:id/categories/:catId
async function removeFromCategory(req, res, next) {
  try {
    const id         = parseInt(req.params.id);
    const categoryId = parseInt(req.params.catId);

    const item = await prisma.menuItem.findUnique({ where: { id } });
    if (!item) throw new AppError('Menu item not found', 404);

    await prisma.menuItemCategory.delete({
      where: { menu_item_id_category_id: { menu_item_id: id, category_id: categoryId } },
    });

    res.json({ data: { message: 'Item removed from category' } });
  } catch (err) { next(err); }
}

// POST /api/menu-items/:id/add-to-category
// Adds an existing dish to a category without touching its other categories.
// Body: { category_id }
async function addToCategory(req, res, next) {
  try {
    const id          = parseInt(req.params.id);
    const category_id = parseInt(req.body.category_id);

    if (!category_id) throw new AppError('category_id is required', 400);

    const [item, category] = await Promise.all([
      prisma.menuItem.findUnique({ where: { id } }),
      prisma.category.findUnique({
        where:   { id: category_id },
        include: { children: { orderBy: { display_order: 'asc' }, select: { id: true } } },
      }),
    ]);
    if (!item)     throw new AppError('Menu item not found', 404);
    if (!category) throw new AppError('Category not found', 404);

    // If the category has subs, place in the first sub instead
    const targetId = category.children.length > 0 ? category.children[0].id : category_id;

    const maxOrder = await prisma.menuItemCategory.aggregate({
      where: { category_id: targetId },
      _max:  { display_order: true },
    });

    await prisma.menuItemCategory.upsert({
      where:  { menu_item_id_category_id: { menu_item_id: id, category_id: targetId } },
      update: {},
      create: {
        menu_item_id:  id,
        category_id:   targetId,
        display_order: (maxOrder._max.display_order ?? -1) + 1,
      },
    });

    res.json({ data: { message: 'Dish added to category', category_id: targetId } });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove, reorderInCategory, moveToCategory, addToCategory, removeFromCategory };
