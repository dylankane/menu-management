// src/controllers/setMenus.js
// CRUD for set menus (MenuItem rows with is_set_menu = true) and their dishes.

const prisma = require('../config/database');
const { AppError } = require('../utils/errors');
const { parseBool, parseIds, extractTranslations } = require('../utils/controllerHelpers');

const FULL_INCLUDE = {
  translations: true,
  categories: {
    include: { category: { include: { translations: true } } },
    orderBy: { display_order: 'asc' },
  },
  set_menu_dishes: {
    include: {
      dish:   { include: { translations: true } },
      course: { include: { translations: true } },
      notes:  true,
    },
    orderBy: [{ course_id: 'asc' }, { display_order: 'asc' }],
  },
};

// GET /api/set-menus
async function list(req, res, next) {
  try {
    const setMenus = await prisma.menuItem.findMany({
      where: { is_set_menu: true },
      include: FULL_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    res.json({ data: { setMenus } });
  } catch (err) {
    next(err);
  }
}

// GET /api/set-menus/:id
async function getOne(req, res, next) {
  try {
    const id      = parseInt(req.params.id);
    const setMenu = await prisma.menuItem.findFirst({
      where: { id, is_set_menu: true },
      include: FULL_INCLUDE,
    });
    if (!setMenu) throw new AppError('Set menu not found', 404);
    res.json({ data: { setMenu } });
  } catch (err) {
    next(err);
  }
}

// POST /api/set-menus
async function create(req, res, next) {
  try {
    const { price, is_available, category_ids } = req.body;

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];

    const translations = extractTranslations(req.body, langs, ['name', 'description']);

    const setMenu = await prisma.menuItem.create({
      data: {
        price:       parseFloat(price),
        image_url:   req.uploadedFile || null,
        is_available: parseBool(is_available, true),
        is_set_menu: true,
        translations: {
          create: translations.filter(t => t.name || t.description),
        },
        categories: parseIds(category_ids).length
          ? { create: parseIds(category_ids).map((cid, i) => ({ category_id: cid, display_order: i })) }
          : undefined,
      },
      include: FULL_INCLUDE,
    });

    res.status(201).json({ data: { setMenu } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/set-menus/:id
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.menuItem.findFirst({ where: { id, is_set_menu: true } });
    if (!existing) throw new AppError('Set menu not found', 404);

    const { price, is_available, category_ids } = req.body;

    const scalarData = {};
    if (price !== undefined) scalarData.price = parseFloat(price);
    if (req.uploadedFile)    scalarData.image_url = req.uploadedFile;

    const formSubmit = price !== undefined;
    if (is_available !== undefined || formSubmit) scalarData.is_available = parseBool(is_available, true);

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];

    await prisma.$transaction(async (tx) => {
      await tx.menuItem.update({ where: { id }, data: scalarData });

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
    });

    const setMenu = await prisma.menuItem.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.json({ data: { setMenu } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/set-menus/:id
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.menuItem.findFirst({ where: { id, is_set_menu: true } });
    if (!existing) throw new AppError('Set menu not found', 404);
    await prisma.menuItem.delete({ where: { id } });
    res.json({ data: { message: 'Set menu deleted' } });
  } catch (err) {
    next(err);
  }
}

// POST /api/set-menus/:id/dishes
async function addDish(req, res, next) {
  try {
    const set_menu_id = parseInt(req.params.id);
    const { dish_id, course_id, display_order } = req.body;

    const setMenu = await prisma.menuItem.findFirst({ where: { id: set_menu_id, is_set_menu: true } });
    if (!setMenu) throw new AppError('Set menu not found', 404);

    const dish = await prisma.menuItem.findFirst({
      where: { id: parseInt(dish_id), is_set_menu: false },
    });
    if (!dish) throw new AppError('Dish not found', 404);

    // Determine next display_order within this course if not supplied
    let order = display_order !== undefined ? parseInt(display_order) : 0;
    if (display_order === undefined && course_id) {
      const lastInCourse = await prisma.setMenuDish.findFirst({
        where: { set_menu_id, course_id: parseInt(course_id) },
        orderBy: { display_order: 'desc' },
      });
      order = lastInCourse ? lastInCourse.display_order + 1 : 0;
    }

    const link = await prisma.setMenuDish.create({
      data: {
        set_menu_id,
        dish_id:       parseInt(dish_id),
        course_id:     course_id ? parseInt(course_id) : null,
        display_order: order,
      },
      include: {
        dish:   { include: { translations: true } },
        course: { include: { translations: true } },
        notes:  true,
      },
    });

    // Save per-language notes if provided
    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];
    for (const lang of langs) {
      const noteVal = req.body[`notes_${lang}`];
      if (noteVal && noteVal.trim()) {
        await prisma.setMenuDishNotes.create({
          data: { set_menu_dish_id: link.id, lang, notes: noteVal.trim() },
        });
      }
    }

    res.status(201).json({ data: { link } });
  } catch (err) {
    if (err.code === 'P2002') return next(new AppError('This dish is already in the set menu', 409));
    next(err);
  }
}

// PUT /api/set-menus/:id/dishes/:dishId
async function updateDish(req, res, next) {
  try {
    const set_menu_id = parseInt(req.params.id);
    const dish_id     = parseInt(req.params.dishId);
    const { course_id, display_order } = req.body;

    const smd = await prisma.setMenuDish.findUnique({
      where: { set_menu_id_dish_id: { set_menu_id, dish_id } },
    });
    if (!smd) throw new AppError('Dish not found in this set menu', 404);

    const link = await prisma.setMenuDish.update({
      where: { set_menu_id_dish_id: { set_menu_id, dish_id } },
      data: {
        ...(course_id     !== undefined && { course_id:     course_id ? parseInt(course_id) : null }),
        ...(display_order !== undefined && { display_order: parseInt(display_order) }),
      },
      include: {
        dish:   { include: { translations: true } },
        course: { include: { translations: true } },
        notes:  true,
      },
    });

    // Update notes
    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];
    for (const lang of langs) {
      const noteVal = req.body[`notes_${lang}`];
      if (noteVal !== undefined) {
        if (noteVal.trim()) {
          await prisma.setMenuDishNotes.upsert({
            where: { set_menu_dish_id_lang: { set_menu_dish_id: smd.id, lang } },
            update: { notes: noteVal.trim() },
            create: { set_menu_dish_id: smd.id, lang, notes: noteVal.trim() },
          });
        } else {
          await prisma.setMenuDishNotes.deleteMany({
            where: { set_menu_dish_id: smd.id, lang },
          });
        }
      }
    }

    res.json({ data: { link } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/set-menus/:id/dishes/:dishId
async function removeDish(req, res, next) {
  try {
    const set_menu_id = parseInt(req.params.id);
    const dish_id     = parseInt(req.params.dishId);

    const smd = await prisma.setMenuDish.findUnique({
      where: { set_menu_id_dish_id: { set_menu_id, dish_id } },
    });
    if (!smd) throw new AppError('Dish not found in this set menu', 404);

    await prisma.setMenuDish.delete({ where: { id: smd.id } });
    res.json({ data: { message: 'Dish removed from set menu' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, addDish, updateDish, removeDish };
