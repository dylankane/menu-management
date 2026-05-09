// scripts/create-super-admin.js
// One-time script to create a super_admin user.
// Usage: node scripts/create-super-admin.js <email> <password> [name]

require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma  = require('../src/config/database');

async function main() {
  const [,, email, password, name = 'Super Admin'] = process.argv;

  if (!email || !password) {
    console.error('Usage: node scripts/create-super-admin.js <email> <password> [name]');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`A user with email "${email}" already exists.`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);
  const user   = await prisma.user.create({
    data: { email, password: hashed, name, role: 'super_admin', is_active: true },
  });

  console.log(`Super admin created: ${user.name} <${user.email}> (id: ${user.id})`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
