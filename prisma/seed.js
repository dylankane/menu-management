// prisma/seed.js
// Creates the required singleton rows and fixed structural records.
// Safe to run multiple times — all operations are upserts.
// Run with: npm run db:seed

require('dotenv').config();
const { Pool }         = require('pg');
const { PrismaPg }     = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

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

  // ── Client account (singleton) ────────────────────────────────────────────
  await prisma.clientAccount.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1 },
  });
  console.log('Seeded client account');

  // ── Restaurant contact (singleton) ────────────────────────────────────────
  await prisma.restaurantContact.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1 },
  });
  console.log('Seeded restaurant contact');

  // ── Announcement (singleton) ───────────────────────────────────────────────
  await prisma.announcement.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1 },
  });
  console.log('Seeded announcement');

  // ── Opening hours (one row per day) ───────────────────────────────────────
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    await prisma.openingHours.upsert({
      where:  { day },
      update: {},
      create: { day, is_closed: false },
    });
  }
  console.log('Seeded opening hours (7 days)');

  console.log('\nSeed complete!');
  console.log('─'.repeat(40));
  console.log('Next step: create your super admin account:');
  console.log('  node scripts/create-super-admin.js <email> <password> [name]');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
