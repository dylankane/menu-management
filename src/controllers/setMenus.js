// src/controllers/setMenus.js
// CRUD for set menus. SetMenu is a standalone model, separate from MenuItem.

const prisma = require('../config/database');
const { AppError } = require('../utils/errors');
const { parseBool, parseIds, extractTranslations } = require('../utils/controllerHelpers');

// Full include: courses with their nested dishes, plus uncategorised dishes
const FULL_INCLUDE = {
  translations: true,
  categories: {
    include: { category: { include: { translations: true } } },
    orderBy: { display_order: 'asc' },
  },
  courses: {
    include: {
      course:       { include: { translations: true } },
      translations: true,
      dishes: {
        include: {
          dish:         { include: { translations: true } },
          translations: true,
        },
        orderBy: { display_order: 'asc' },
      },
    },
    orderBy: { display_order: 'asc' },
  },
  dishes: {
    where:   { set_menu_course_id: null },
    include: {
      dish:         { include: { translations: true } },
      translations: true,
    },
    orderBy: { display_order: 'asc' },
  },
};

// GET /api/set-menus
async function list(req, res, next) {
  try {
    const setMenus = await prisma.setMenu.findMany({
      include: FULL_INCLUDE,
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    });
    res.json({ data: { setMenus } });
  } catch (err) { next(err); }
}

// GET /api/set-menus/:id
async function getOne(req, res, next) {
  try {
    const id      = parseInt(req.params.id);
    const setMenu = await prisma.setMenu.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!setMenu) throw new AppError('Set menu not found', 404);
    res.json({ data: { setMenu } });
  } catch (err) { next(err); }
}

// POST /api/set-menus
async function create(req, res, next) {
  try {
    const { price, is_available, is_special, category_ids, has_discount, discount_type, discount_value } = req.body;

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? settings.enabled_languages : ['en', 'es'];
    const translations = extractTranslations(req.body, langs, ['name', 'description', 'public_notes', 'price_note']);

    const setMenu = await prisma.setMenu.create({
      data: {
        price:          (price !== '' && price != null) ? parseFloat(price) : null,
        image_url:      req.uploadedFile || null,
        is_available:   parseBool(is_available, true),
        is_special:     parseBool(is_special, false),
        has_discount:   parseBool(has_discount, false),
        discount_type:  discount_type  || null,
        discount_value: discount_value ? parseFloat(discount_value) : null,
        notes:          req.body.notes || null,
        translations: {
          create: translations.filter(t => t.name || t.description || t.price_note),
        },
        categories: parseIds(category_ids).length
          ? { create: parseIds(category_ids).map((cid, i) => ({ category_id: cid, display_order: i })) }
          : undefined,
      },
      include: FULL_INCLUDE,
    });

    res.status(201).json({ data: { setMenu } });
  } catch (err) { next(err); }
}

// PUT /api/set-menus/:id
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.setMenu.findUnique({ where: { id } });
    if (!existing) throw new AppError('Set menu not found', 404);

    const { price, is_available, is_special, category_ids, has_discount, discount_type, discount_value } = req.body;

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? settings.enabled_languages : ['en', 'es'];

    await prisma.$transaction(async (tx) => {
      const scalarData = {};
      if (price !== undefined)           scalarData.price        = (price !== '' && price != null) ? parseFloat(price) : null;
      if (req.uploadedFile)              scalarData.image_url    = req.uploadedFile;
      if (req.body.notes !== undefined)  scalarData.notes        = req.body.notes || null;
      const formSubmit = price !== undefined;
      if (is_available !== undefined || formSubmit) scalarData.is_available  = parseBool(is_available, true);
      if (is_special    !== undefined || formSubmit) scalarData.is_special    = parseBool(is_special, false);
      if (has_discount  !== undefined || formSubmit) scalarData.has_discount  = parseBool(has_discount, false);
      if (discount_type  !== undefined) scalarData.discount_type  = discount_type  || null;
      if (discount_value !== undefined) scalarData.discount_value = discount_value ? parseFloat(discount_value) : null;

      await tx.setMenu.update({ where: { id }, data: scalarData });

      const translations = extractTranslations(req.body, langs, ['name', 'description', 'public_notes', 'price_note']);
      for (const t of translations) {
        if (t.name !== undefined || t.description !== undefined || t.public_notes !== undefined || t.price_note !== undefined) {
          await tx.setMenuTranslation.upsert({
            where:  { set_menu_id_lang: { set_menu_id: id, lang: t.lang } },
            update: { name: t.name, description: t.description, public_notes: t.public_notes, price_note: t.price_note },
            create: { set_menu_id: id, lang: t.lang, name: t.name, description: t.description, public_notes: t.public_notes, price_note: t.price_note },
          });
        }
      }

      if (category_ids !== undefined) {
        await tx.setMenuCategory.deleteMany({ where: { set_menu_id: id } });
        if (parseIds(category_ids).length) {
          await tx.setMenuCategory.createMany({
            data: parseIds(category_ids).map((cid, i) => ({
              set_menu_id: id, category_id: cid, display_order: i,
            })),
          });
        }
      }
    });

    const setMenu = await prisma.setMenu.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.json({ data: { setMenu } });
  } catch (err) { next(err); }
}

// DELETE /api/set-menus/:id
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.setMenu.findUnique({ where: { id } });
    if (!existing) throw new AppError('Set menu not found', 404);
    await prisma.setMenu.delete({ where: { id } });
    res.json({ data: { message: 'Set menu deleted' } });
  } catch (err) { next(err); }
}

// POST /api/set-menus/:id/courses — add a course section to a set menu
async function addCourse(req, res, next) {
  try {
    const set_menu_id = parseInt(req.params.id);
    const course_id   = parseInt(req.body.course_id);

    const setMenu = await prisma.setMenu.findUnique({ where: { id: set_menu_id } });
    if (!setMenu) throw new AppError('Set menu not found', 404);

    const course = await prisma.course.findUnique({ where: { id: course_id } });
    if (!course) throw new AppError('Course not found', 404);

    const last = await prisma.setMenuCourse.findFirst({
      where:   { set_menu_id },
      orderBy: { display_order: 'desc' },
    });

    const setMenuCourse = await prisma.setMenuCourse.upsert({
      where:  { set_menu_id_course_id: { set_menu_id, course_id } },
      update: {},
      create: { set_menu_id, course_id, display_order: last ? last.display_order + 1 : 0 },
      include: {
        course:       { include: { translations: true } },
        translations: true,
        dishes:       true,
      },
    });

    res.status(201).json({ data: { setMenuCourse } });
  } catch (err) { next(err); }
}

// PATCH /api/set-menus/:id/courses/:courseId — update per-set-menu course notes
async function updateCourse(req, res, next) {
  try {
    const set_menu_id = parseInt(req.params.id);
    const id          = parseInt(req.params.courseId);

    const smc = await prisma.setMenuCourse.findUnique({ where: { id } });
    if (!smc || smc.set_menu_id !== set_menu_id) throw new AppError('Course section not found', 404);

    if (req.body.notes !== undefined) {
      await prisma.setMenuCourse.update({
        where: { id },
        data:  { notes: req.body.notes || null },
      });
    }

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? settings.enabled_languages : ['en', 'es'];

    for (const lang of langs) {
      const val = req.body[`notes_${lang}`];
      if (val !== undefined) {
        if (val.trim()) {
          await prisma.setMenuCourseTranslation.upsert({
            where:  { set_menu_course_id_lang: { set_menu_course_id: id, lang } },
            update: { notes: val.trim() },
            create: { set_menu_course_id: id, lang, notes: val.trim() },
          });
        } else {
          await prisma.setMenuCourseTranslation.deleteMany({ where: { set_menu_course_id: id, lang } });
        }
      }
    }

    const updated = await prisma.setMenuCourse.findUnique({
      where:   { id },
      include: {
        course:       { include: { translations: true } },
        translations: true,
        dishes: {
          include: { dish: { include: { translations: true } }, translations: true },
          orderBy: { display_order: 'asc' },
        },
      },
    });
    res.json({ data: { setMenuCourse: updated } });
  } catch (err) { next(err); }
}

// DELETE /api/set-menus/:id/courses/:courseId — remove course section (cascades to its dishes)
async function removeCourse(req, res, next) {
  try {
    const set_menu_id        = parseInt(req.params.id);
    const set_menu_course_id = parseInt(req.params.courseId);

    const smc = await prisma.setMenuCourse.findUnique({ where: { id: set_menu_course_id } });
    if (!smc || smc.set_menu_id !== set_menu_id) throw new AppError('Course section not found', 404);

    await prisma.setMenuCourse.delete({ where: { id: set_menu_course_id } });
    res.json({ data: { message: 'Course section removed' } });
  } catch (err) { next(err); }
}

// PATCH /api/set-menus/:id/courses/reorder
async function reorderCourses(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) throw new AppError('items must be an array', 400);
    await prisma.$transaction(
      items.map(({ id, display_order }) =>
        prisma.setMenuCourse.update({
          where: { id: parseInt(id) },
          data:  { display_order: parseInt(display_order) },
        })
      )
    );
    res.json({ data: { message: 'Reordered' } });
  } catch (err) { next(err); }
}

// POST /api/set-menus/:id/dishes
async function addDish(req, res, next) {
  try {
    const set_menu_id        = parseInt(req.params.id);
    const { dish_id, set_menu_course_id, display_order } = req.body;

    const setMenu = await prisma.setMenu.findUnique({ where: { id: set_menu_id } });
    if (!setMenu) throw new AppError('Set menu not found', 404);

    const dish = await prisma.menuItem.findUnique({ where: { id: parseInt(dish_id) } });
    if (!dish) throw new AppError('Dish not found', 404);

    const courseId = set_menu_course_id ? parseInt(set_menu_course_id) : null;

    // Guard: if set menu has courses, a course must be specified
    const courseCount = await prisma.setMenuCourse.count({ where: { set_menu_id } });
    if (courseCount > 0 && !courseId) {
      throw new AppError('This set menu has courses — please assign the item to a course', 400);
    }

    let order = display_order !== undefined ? parseInt(display_order) : 0;
    if (display_order === undefined) {
      const last = await prisma.setMenuDish.findFirst({
        where:   { set_menu_id, set_menu_course_id: courseId },
        orderBy: { display_order: 'desc' },
      });
      order = last ? last.display_order + 1 : 0;
    }

    const link = await prisma.setMenuDish.create({
      data: {
        set_menu_id,
        dish_id:            parseInt(dish_id),
        set_menu_course_id: courseId,
        display_order:      order,
      },
      include: {
        dish:            { include: { translations: true } },
        set_menu_course: { include: { course: { include: { translations: true } } } },
        translations:    true,
      },
    });

    // Save per-language notes if provided
    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? settings.enabled_languages : ['en', 'es'];
    for (const lang of langs) {
      const noteVal = req.body[`notes_${lang}`];
      if (noteVal && noteVal.trim()) {
        await prisma.setMenuDishTranslation.upsert({
          where:  { set_menu_dish_id_lang: { set_menu_dish_id: link.id, lang } },
          update: { notes: noteVal.trim() },
          create: { set_menu_dish_id: link.id, lang, notes: noteVal.trim() },
        });
      }
    }

    res.status(201).json({ data: { link } });
  } catch (err) {
    if (err.code === 'P2002') return next(new AppError('This dish is already in the set menu', 409));
    next(err);
  }
}

// PUT /api/set-menus/:id/dishes/:entryId — move dish to different course or update order
// :entryId is SetMenuDish.id (not dish_id)
async function updateDish(req, res, next) {
  try {
    const set_menu_id = parseInt(req.params.id);
    const id          = parseInt(req.params.entryId);
    const { set_menu_course_id, display_order } = req.body;

    const smd = await prisma.setMenuDish.findFirst({ where: { id, set_menu_id } });
    if (!smd) throw new AppError('Dish not found in this set menu', 404);

    const data = {};
    if (set_menu_course_id !== undefined) data.set_menu_course_id = set_menu_course_id ? parseInt(set_menu_course_id) : null;
    if (display_order      !== undefined) data.display_order      = parseInt(display_order);

    const link = await prisma.setMenuDish.update({
      where: { id },
      data,
      include: {
        dish:         { include: { translations: true } },
        translations: true,
      },
    });

    // Update notes if provided
    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? settings.enabled_languages : ['en', 'es'];
    for (const lang of langs) {
      const noteVal = req.body[`notes_${lang}`];
      if (noteVal !== undefined) {
        if (noteVal.trim()) {
          await prisma.setMenuDishTranslation.upsert({
            where:  { set_menu_dish_id_lang: { set_menu_dish_id: id, lang } },
            update: { notes: noteVal.trim() },
            create: { set_menu_dish_id: id, lang, notes: noteVal.trim() },
          });
        } else {
          await prisma.setMenuDishTranslation.deleteMany({ where: { set_menu_dish_id: id, lang } });
        }
      }
    }

    res.json({ data: { link } });
  } catch (err) { next(err); }
}

// DELETE /api/set-menus/:id/dishes/:entryId
async function removeDish(req, res, next) {
  try {
    const set_menu_id = parseInt(req.params.id);
    const id          = parseInt(req.params.entryId);

    const smd = await prisma.setMenuDish.findFirst({ where: { id, set_menu_id } });
    if (!smd) throw new AppError('Dish not found in this set menu', 404);

    await prisma.setMenuDish.delete({ where: { id } });
    res.json({ data: { message: 'Dish removed from set menu' } });
  } catch (err) { next(err); }
}

// DELETE /api/set-menus/:id/categories/:catId
async function removeFromCategory(req, res, next) {
  try {
    const set_menu_id = parseInt(req.params.id);
    const category_id = parseInt(req.params.catId);

    const sm = await prisma.setMenu.findUnique({ where: { id: set_menu_id } });
    if (!sm) throw new AppError('Set menu not found', 404);

    await prisma.setMenuCategory.delete({
      where: { set_menu_id_category_id: { set_menu_id, category_id } },
    });

    res.json({ data: { message: 'Set menu removed from category' } });
  } catch (err) { next(err); }
}

// PATCH /api/set-menus/reorder-in-category — reorder set menus within a specific category
async function reorderInCategory(req, res, next) {
  try {
    const { category_id, items } = req.body;
    if (!category_id || !Array.isArray(items)) throw new AppError('category_id and items required', 400);
    await prisma.$transaction(
      items.map(({ set_menu_id, display_order }) =>
        prisma.setMenuCategory.update({
          where: { set_menu_id_category_id: { set_menu_id: parseInt(set_menu_id), category_id: parseInt(category_id) } },
          data:  { display_order: parseInt(display_order) },
        })
      )
    );
    res.json({ data: { message: 'Reordered' } });
  } catch (err) { next(err); }
}

// PATCH /api/set-menus/:id/move-category — move set menu from one category to another
async function moveCategory(req, res, next) {
  try {
    const set_menu_id      = parseInt(req.params.id);
    const from_category_id = parseInt(req.body.from_category_id);
    const to_category_id   = parseInt(req.body.to_category_id);

    await prisma.$transaction(async (tx) => {
      await tx.setMenuCategory.delete({
        where: { set_menu_id_category_id: { set_menu_id, category_id: from_category_id } },
      });
      const last = await tx.setMenuCategory.findFirst({
        where:   { category_id: to_category_id },
        orderBy: { display_order: 'desc' },
      });
      await tx.setMenuCategory.create({
        data: { set_menu_id, category_id: to_category_id, display_order: last ? last.display_order + 1 : 0 },
      });
    });

    res.json({ data: { message: 'Moved' } });
  } catch (err) {
    if (err.code === 'P2002') return next(new AppError('That set menu is already in this category', 409));
    next(err);
  }
}

// POST /api/set-menus/:id/add-to-category
// Appends a set menu to a category without replacing its existing categories.
async function addToCategory(req, res, next) {
  try {
    const id          = parseInt(req.params.id);
    const category_id = parseInt(req.body.category_id);

    if (!category_id) throw new AppError('category_id is required', 400);

    const [sm, category] = await Promise.all([
      prisma.setMenu.findUnique({ where: { id } }),
      prisma.category.findUnique({
        where:   { id: category_id },
        include: { children: { orderBy: { display_order: 'asc' }, select: { id: true } } },
      }),
    ]);
    if (!sm)       throw new AppError('Set menu not found', 404);
    if (!category) throw new AppError('Category not found', 404);

    // If the category has subs, place in the first sub instead
    const targetId = category.children.length > 0 ? category.children[0].id : category_id;

    const maxOrder = await prisma.setMenuCategory.aggregate({
      where: { category_id: targetId },
      _max:  { display_order: true },
    });

    await prisma.setMenuCategory.upsert({
      where:  { set_menu_id_category_id: { set_menu_id: id, category_id: targetId } },
      update: {},
      create: {
        set_menu_id:   id,
        category_id:   targetId,
        display_order: (maxOrder._max.display_order ?? -1) + 1,
      },
    });

    res.json({ data: { message: 'Set menu added to category', category_id: targetId } });
  } catch (err) {
    if (err.code === 'P2002') return next(new AppError('That set menu is already in this category', 409));
    next(err);
  }
}

// PATCH /api/set-menus/reorder
async function reorder(req, res, next) {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) throw new AppError('items must be an array', 400);
    await prisma.$transaction(
      items.map(({ id, display_order }) =>
        prisma.setMenu.update({
          where: { id: parseInt(id) },
          data:  { display_order: parseInt(display_order) },
        })
      )
    );
    res.json({ data: { message: 'Reordered' } });
  } catch (err) { next(err); }
}

// PATCH /api/set-menus/:id/dishes/reorder
async function reorderDishes(req, res, next) {
  try {
    const set_menu_id = parseInt(req.params.id);
    const { items } = req.body;
    if (!Array.isArray(items)) throw new AppError('items must be an array', 400);
    await prisma.$transaction(
      items.map(({ id, display_order }) =>
        prisma.setMenuDish.update({
          where: { id: parseInt(id) },
          data:  { display_order: parseInt(display_order) },
        })
      )
    );
    res.json({ data: { message: 'Reordered' } });
  } catch (err) { next(err); }
}

module.exports = {
  list, getOne, create, update, remove,
  addCourse, updateCourse, removeCourse, reorderCourses,
  addDish, updateDish, removeDish,
  reorder, reorderDishes, reorderInCategory, moveCategory, removeFromCategory, addToCategory,
};
