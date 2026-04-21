// src/config/database.js
// Prisma 7 uses a database adapter model instead of embedding the URL in
// PrismaClient directly. We create a pg connection pool and hand it to the
// adapter, then pass the adapter to PrismaClient.

require('dotenv').config();
const { Pool }          = require('pg');
const { PrismaPg }      = require('@prisma/adapter-pg');
const { PrismaClient }  = require('@prisma/client');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

module.exports = prisma;
