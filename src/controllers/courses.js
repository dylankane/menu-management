// src/controllers/courses.js

const prisma = require('../config/database');
const { AppError } = require('../utils/errors');
const { extractTranslations } = require('../utils/controllerHelpers');

const WITH_TRANSLATIONS = { translations: { orderBy: { lang: 'asc' } } };

// GET /api/courses
async function list(req, res, next) {
  try {
    const courses = await prisma.course.findMany({
      include: WITH_TRANSLATIONS,
      orderBy: { display_order: 'asc' },
    });
    res.json({ data: { courses } });
  } catch (err) {
    next(err);
  }
}

// POST /api/courses
async function create(req, res, next) {
  try {
    const { display_order } = req.body;

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];

    const translations = extractTranslations(req.body, langs, ['name'])
      .filter(t => t.name);

    const course = await prisma.course.create({
      data: {
        display_order: display_order ? parseInt(display_order) : 0,
        translations: { create: translations },
      },
      include: WITH_TRANSLATIONS,
    });

    res.status(201).json({ data: { course } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/courses/:id
async function update(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    const { display_order } = req.body;

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) throw new AppError('Course not found', 404);

    const settings = await prisma.restaurantSettings.findFirst();
    const langs    = settings ? (settings.enabled_languages) : ['en', 'es'];

    await prisma.$transaction(async (tx) => {
      if (display_order !== undefined) {
        await tx.course.update({ where: { id }, data: { display_order: parseInt(display_order) } });
      }

      const translations = extractTranslations(req.body, langs, ['name']);
      for (const t of translations) {
        if (t.name) {
          await tx.courseTranslation.upsert({
            where: { course_id_lang: { course_id: id, lang: t.lang } },
            update: { name: t.name },
            create: { course_id: id, lang: t.lang, name: t.name },
          });
        }
      }
    });

    const course = await prisma.course.findUnique({ where: { id }, include: WITH_TRANSLATIONS });
    res.json({ data: { course } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/courses/:id
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.course.findUnique({ where: { id } });
    if (!existing) throw new AppError('Course not found', 404);

    // Check if this course is in use
    const inUse = await prisma.setMenuDish.findFirst({ where: { course_id: id } });
    if (inUse) throw new AppError('This course is in use by a set menu and cannot be deleted', 400);

    await prisma.course.delete({ where: { id } });
    res.json({ data: { message: 'Course deleted' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
