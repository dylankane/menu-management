// src/helpers/i18n.js
// Admin UI translation helper.
// Loads locale JSON files once at startup and provides a t() lookup function.

const fs   = require('fs');
const path = require('path');

const SUPPORTED = ['en', 'es'];
const FALLBACK  = 'en';

const locales = {};

function loadLocales() {
  SUPPORTED.forEach(lang => {
    const file = path.join(__dirname, '../../locales/admin', `${lang}.json`);
    try {
      locales[lang] = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      locales[lang] = {};
    }
  });
}

loadLocales();

// Resolve a dot-namespaced key in a locale object.
// Returns undefined when the key is not found.
function resolve(obj, key) {
  return key.split('.').reduce((cur, part) => (cur && typeof cur === 'object' ? cur[part] : undefined), obj);
}

// Returns a t() function bound to the given language.
// t('nav.overview') → "Overview" / "Resumen"
// Falls back to the English value, then the raw key string.
function createT(lang) {
  const locale  = locales[lang] || locales[FALLBACK] || {};
  const fbLocale = locales[FALLBACK] || {};

  return function t(key) {
    const val = resolve(locale, key) ?? resolve(fbLocale, key);
    return val !== undefined ? String(val) : key;
  };
}

// Returns the full locale object for a language (used to pass to client JS as UI_TRANS).
function getLocale(lang) {
  return locales[lang] || locales[FALLBACK] || {};
}

// Validate and normalise the requested UI language.
function resolveUiLang(requested) {
  if (requested && SUPPORTED.includes(requested)) return requested;
  return FALLBACK;
}

module.exports = { createT, getLocale, resolveUiLang, SUPPORTED };
