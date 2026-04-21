// src/utils/controllerHelpers.js
// Shared helpers used across API controllers.

/**
 * Parse a boolean from multipart form data or JSON body.
 * HTML checkboxes send "on"; JSON may send true/false/"true"/"false"/"1".
 */
function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true' || value === 'on' || value === '1';
}

/**
 * Parse an array of integer IDs from form data or JSON body.
 * Handles: undefined, single number, single string, JSON-encoded array,
 * or a real JS array.
 */
function parseIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return (Array.isArray(parsed) ? parsed : [parsed]).map(Number).filter(Boolean);
  } catch {
    return [Number(value)].filter(Boolean);
  }
}

/**
 * Extract per-language translation fields from a flat form body.
 * Field naming convention: `name_en`, `description_es`, etc.
 *
 * @param {object} body      - req.body
 * @param {string[]} langs   - enabled language codes e.g. ['en','es']
 * @param {string[]} fields  - field names to extract e.g. ['name','description','notes']
 * @returns {Array<{lang, ...fields}>} — rows ready for Prisma upsert
 */
function extractTranslations(body, langs, fields) {
  return langs.map(lang => {
    const row = { lang };
    for (const field of fields) {
      const val = body[`${field}_${lang}`];
      row[field] = val !== undefined ? (val.trim() || null) : null;
    }
    return row;
  });
}

/**
 * Pick the best available translation for a given language.
 * Falls back: requested lang → primary lang → first available → empty object.
 */
function pickTranslation(translations, lang, primaryLang = 'en') {
  if (!translations || translations.length === 0) return {};
  const byLang = {};
  for (const t of translations) byLang[t.lang] = t;
  return byLang[lang] || byLang[primaryLang] || translations[0] || {};
}

/**
 * Generate a URL-safe slug from a string.
 * e.g. "Chef's Suggestions" → "chefs-suggestions"
 */
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

module.exports = { parseBool, parseIds, extractTranslations, pickTranslation, slugify };
