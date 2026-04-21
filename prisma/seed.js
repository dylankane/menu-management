// prisma/seed.js
// Populates the database with sensible defaults for a new restaurant client.
// Run with: npm run db:seed

require('dotenv').config();
const { Pool }         = require('pg');
const { PrismaPg }     = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcryptjs');

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // ── Restaurant settings (singleton) ────────────────────────────────────────
  await prisma.restaurantSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      restaurant_name:   process.env.RESTAURANT_NAME || 'My Restaurant',
      primary_language:  'en',
      enabled_languages: ['en', 'es'],
    },
  });
  console.log('Seeded restaurant settings');

  // ── Admin user ─────────────────────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@restaurant.com' },
    update: {},
    create: {
      email:    'admin@restaurant.com',
      password: hashedPassword,
      name:     'Restaurant Admin',
      role:     'admin',
    },
  });
  console.log(`Seeded admin user: ${adminUser.email}`);

  // ── Allergen tags (EU FIC regulation 14 major allergens) ───────────────────
  const allergens = [
    { en: 'Gluten',      es: 'Gluten'      },
    { en: 'Crustaceans', es: 'Crustáceos'  },
    { en: 'Eggs',        es: 'Huevos'      },
    { en: 'Fish',        es: 'Pescado'     },
    { en: 'Peanuts',     es: 'Cacahuetes'  },
    { en: 'Soybeans',    es: 'Soja'        },
    { en: 'Dairy',       es: 'Lácteos'     },
    { en: 'Nuts',        es: 'Frutos secos'},
    { en: 'Celery',      es: 'Apio'        },
    { en: 'Mustard',     es: 'Mostaza'     },
    { en: 'Sesame',      es: 'Sésamo'      },
    { en: 'Sulphites',   es: 'Sulfitos'    },
    { en: 'Lupin',       es: 'Altramuces'  },
    { en: 'Molluscs',    es: 'Moluscos'    },
  ];

  for (const a of allergens) {
    // Find by English translation, create if not found
    const existing = await prisma.allergenTagTranslation.findFirst({
      where: { lang: 'en', name: a.en },
    });
    let allergenId;
    if (existing) {
      allergenId = existing.allergen_id;
    } else {
      const tag = await prisma.allergenTag.create({ data: {} });
      allergenId = tag.id;
    }
    await prisma.allergenTagTranslation.upsert({
      where: { allergen_id_lang: { allergen_id: allergenId, lang: 'en' } },
      update: { name: a.en },
      create: { allergen_id: allergenId, lang: 'en', name: a.en },
    });
    await prisma.allergenTagTranslation.upsert({
      where: { allergen_id_lang: { allergen_id: allergenId, lang: 'es' } },
      update: { name: a.es },
      create: { allergen_id: allergenId, lang: 'es', name: a.es },
    });
  }
  console.log(`Seeded ${allergens.length} allergen tags`);

  // ── Dietary tags ───────────────────────────────────────────────────────────
  const dietaryTags = [
    { en: 'Vegan',       es: 'Vegano'           },
    { en: 'Vegetarian',  es: 'Vegetariano'       },
    { en: 'Gluten-Free', es: 'Sin Gluten'        },
    { en: 'Dairy-Free',  es: 'Sin Lácteos'       },
    { en: 'Halal',       es: 'Halal'             },
    { en: 'Kosher',      es: 'Kosher'            },
    { en: 'Nut-Free',    es: 'Sin Frutos Secos'  },
    { en: 'Spicy',       es: 'Picante'           },
  ];

  for (const d of dietaryTags) {
    const existing = await prisma.dietaryTagTranslation.findFirst({
      where: { lang: 'en', name: d.en },
    });
    let dietaryId;
    if (existing) {
      dietaryId = existing.dietary_id;
    } else {
      const tag = await prisma.dietaryTag.create({ data: {} });
      dietaryId = tag.id;
    }
    await prisma.dietaryTagTranslation.upsert({
      where: { dietary_id_lang: { dietary_id: dietaryId, lang: 'en' } },
      update: { name: d.en },
      create: { dietary_id: dietaryId, lang: 'en', name: d.en },
    });
    await prisma.dietaryTagTranslation.upsert({
      where: { dietary_id_lang: { dietary_id: dietaryId, lang: 'es' } },
      update: { name: d.es },
      create: { dietary_id: dietaryId, lang: 'es', name: d.es },
    });
  }
  console.log(`Seeded ${dietaryTags.length} dietary tags`);

  // ── Courses ────────────────────────────────────────────────────────────────
  const courses = [
    { display_order: 0, en: 'Starter',  es: 'Entrante'  },
    { display_order: 1, en: 'Main',     es: 'Principal' },
    { display_order: 2, en: 'Dessert',  es: 'Postre'    },
    { display_order: 3, en: 'Side',     es: 'Acompañamiento' },
    { display_order: 4, en: 'Drink',    es: 'Bebida'    },
  ];

  for (const c of courses) {
    const existing = await prisma.courseTranslation.findFirst({
      where: { lang: 'en', name: c.en },
    });
    let courseId;
    if (existing) {
      courseId = existing.course_id;
    } else {
      const course = await prisma.course.create({ data: { display_order: c.display_order } });
      courseId = course.id;
    }
    await prisma.courseTranslation.upsert({
      where: { course_id_lang: { course_id: courseId, lang: 'en' } },
      update: { name: c.en },
      create: { course_id: courseId, lang: 'en', name: c.en },
    });
    await prisma.courseTranslation.upsert({
      where: { course_id_lang: { course_id: courseId, lang: 'es' } },
      update: { name: c.es },
      create: { course_id: courseId, lang: 'es', name: c.es },
    });
  }
  console.log(`Seeded ${courses.length} courses`);

  // ── Categories ─────────────────────────────────────────────────────────────
  const topLevelCategories = [
    { slug: 'chefs-suggestions', display_order: 0, is_protected: true,
      en: { name: "Chef's Suggestions", description: 'Handpicked dishes recommended by our chef' },
      es: { name: 'Sugerencias del Chef', description: 'Platos seleccionados recomendados por nuestro chef' } },
    { slug: 'starters',  display_order: 1, is_protected: false, en: { name: 'Starters',  description: null }, es: { name: 'Entrantes', description: null } },
    { slug: 'mains',     display_order: 2, is_protected: false, en: { name: 'Mains',     description: null }, es: { name: 'Principales', description: null } },
    { slug: 'desserts',  display_order: 3, is_protected: false, en: { name: 'Desserts',  description: null }, es: { name: 'Postres',   description: null } },
    { slug: 'drinks',    display_order: 4, is_protected: false, en: { name: 'Drinks',    description: null }, es: { name: 'Bebidas',   description: null } },
  ];

  const createdCategories = {};
  for (const cat of topLevelCategories) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        slug:          cat.slug,
        display_order: cat.display_order,
        is_protected:  cat.is_protected,
      },
    });
    createdCategories[cat.slug] = created;
    for (const lang of ['en', 'es']) {
      await prisma.categoryTranslation.upsert({
        where: { category_id_lang: { category_id: created.id, lang } },
        update: { name: cat[lang].name, description: cat[lang].description },
        create: { category_id: created.id, lang, name: cat[lang].name, description: cat[lang].description },
      });
    }
  }
  console.log(`Seeded ${topLevelCategories.length} top-level categories`);

  // Sample subcategories under Drinks
  const drinkSubcategories = [
    { slug: 'soft-drinks', display_order: 0, en: 'Soft Drinks', es: 'Refrescos'     },
    { slug: 'hot-drinks',  display_order: 1, en: 'Hot Drinks',  es: 'Bebidas Calientes' },
    { slug: 'wine',        display_order: 2, en: 'Wine',        es: 'Vino'           },
    { slug: 'beer',        display_order: 3, en: 'Beer',        es: 'Cerveza'        },
  ];

  for (const sub of drinkSubcategories) {
    const created = await prisma.category.upsert({
      where: { slug: sub.slug },
      update: {},
      create: {
        slug:          sub.slug,
        display_order: sub.display_order,
        parent_id:     createdCategories['drinks'].id,
      },
    });
    for (const lang of ['en', 'es']) {
      await prisma.categoryTranslation.upsert({
        where: { category_id_lang: { category_id: created.id, lang } },
        update: { name: sub[lang] },
        create: { category_id: created.id, lang, name: sub[lang] },
      });
    }
  }
  console.log(`Seeded ${drinkSubcategories.length} drink subcategories`);

  console.log('\nSeed complete!');
  console.log('─'.repeat(40));
  console.log('Default admin credentials:');
  console.log('  Email:    admin@restaurant.com');
  console.log('  Password: admin123');
  console.log('\nChange these immediately after deployment!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
