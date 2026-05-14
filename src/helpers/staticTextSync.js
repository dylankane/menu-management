// src/helpers/staticTextSync.js
// On server startup, scans all customer-facing EJS templates for mt('key') calls
// and seeds the static_translations table with any missing rows (one per enabled language).
// Existing non-empty rows are never overwritten.
// English defaults are loaded from locales/customer/en.json and applied to empty EN rows.

const fs     = require('fs');
const path   = require('path');
const prisma = require('../config/database');

const TEMPLATES_DIR  = path.join(__dirname, '../views/customer');
const MT_PATTERN     = /\bmt\(\s*['"]([^'"]+)['"]\s*[,)]/g;

function loadDefaults(lang) {
  const file = path.join(__dirname, `../../locales/customer/${lang}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function scanFile(filePath) {
  const keys = new Set();
  try {
    const src = fs.readFileSync(filePath, 'utf8');
    let match;
    MT_PATTERN.lastIndex = 0;
    while ((match = MT_PATTERN.exec(src)) !== null) {
      keys.add(match[1]);
    }
  } catch { /* skip unreadable files */ }
  return keys;
}

function walkDir(dir) {
  const keys = new Set();
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return keys; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full).forEach(k => keys.add(k));
    } else if (entry.isFile() && entry.name.endsWith('.ejs')) {
      scanFile(full).forEach(k => keys.add(k));
    }
  }
  return keys;
}

async function syncStaticTranslations() {
  const discoveredKeys = [...walkDir(TEMPLATES_DIR)];
  if (discoveredKeys.length === 0) return;

  let enabledLangs;
  try {
    const settings = await prisma.restaurantSettings.findFirst({
      select: { enabled_languages: true },
    });
    enabledLangs = settings?.enabled_languages || ['en', 'es'];
    if (!Array.isArray(enabledLangs)) enabledLangs = ['en', 'es'];
  } catch {
    enabledLangs = ['en', 'es'];
  }

  const defaults = {};
  for (const lang of enabledLangs) defaults[lang] = loadDefaults(lang);

  // Fetch all existing rows
  const existing = await prisma.staticTranslation.findMany({
    select: { key: true, lang: true, value: true },
  });
  const existingMap = new Map(existing.map(r => [`${r.key}::${r.lang}`, r.value]));

  const toCreate = [];
  const toUpdate = [];

  for (const key of discoveredKeys) {
    for (const lang of enabledLangs) {
      const compositeKey  = `${key}::${lang}`;
      const defaultVal    = (defaults[lang] || {})[key] || '';
      const existingValue = existingMap.get(compositeKey);

      if (existingValue === undefined) {
        toCreate.push({ key, lang, value: defaultVal });
      } else if (existingValue === '' && defaultVal !== '') {
        toUpdate.push({ key, lang, value: defaultVal });
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.staticTranslation.createMany({ data: toCreate, skipDuplicates: true });
    console.log(`[i18n] Seeded ${toCreate.length} static translation rows.`);
  }

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map(r =>
        prisma.staticTranslation.update({
          where: { key_lang: { key: r.key, lang: r.lang } },
          data:  { value: r.value },
        })
      )
    );
    console.log(`[i18n] Backfilled ${toUpdate.length} empty rows with defaults.`);
  }
}

module.exports = { syncStaticTranslations };
