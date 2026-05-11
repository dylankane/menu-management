# Multilingual System

How language support works across the admin interface and the customer-facing menu — what the parts are, how they connect, and how to update or extend them.

---

## Overview

There are three separate translation layers in this system, each serving a different purpose:

| Layer | What it translates | Where it lives |
|---|---|---|
| **Admin UI** | Labels, buttons, headings in the admin panel | `locales/admin/en.json` and `es.json` |
| **Customer static text** | Fixed phrases on customer pages (e.g. "Join the Gourmet Club", form labels) | Database — `StaticTranslation` table |
| **Content data** | Menu item names, category names, allergens, set menus, etc. | Database — `*_translations` tables per model |

---

## Layer 1 — Admin UI Translations

### What it does

Every piece of text in the admin interface (page titles, button labels, table headings, modal copy, error messages) is stored in locale JSON files rather than hardcoded in the templates.

### Files

| File | Role |
|---|---|
| `locales/admin/en.json` | English strings for the admin UI |
| `locales/admin/es.json` | Spanish strings for the admin UI |
| `src/helpers/i18n.js` | Loads the locale files, creates the `t()` function |
| `src/middleware/loadSettings.js` | Calls `i18n.js` and attaches `t()` to `res.locals` so every admin template can use it |

### How it works

1. When a request hits any admin page, `loadSettings` middleware runs first.
2. It reads the `ui_lang` cookie set on the admin's browser (default: `en`).
3. It builds a `t('key')` function using the matching locale file.
4. Every admin EJS template calls `t('some.key')` wherever it needs a string.

### How the admin changes language

The admin uses the language selector in the top-right of every admin page. Clicking a language sets the `ui_lang` cookie and reloads the page. The new `t()` function then serves strings from the corresponding locale file.

### How to update or add strings

Open `locales/admin/en.json` and/or `locales/admin/es.json` and edit the value for the relevant key. The files are organised by page:

```
common.*          — shared strings (Save, Cancel, Delete, etc.)
page.dashboard.*  — dashboard page
page.settings.*   — settings page
page.builder.*    — menu builder page
...
```

To add a new string:
1. Add the key and English value to `en.json`.
2. Add the same key and Spanish value to `es.json`.
3. Use `<%= t('your.new.key') %>` in the admin EJS template.
4. Restart the server (locale files are loaded at startup).

---

## Layer 2 — Customer Static Text Translations

### What it does

The customer-facing pages have fixed phrases that need translating — things like "Join our Gourmet Club", form labels, footer links, and the cookie banner text. These are stored in the database so they can be edited through the admin panel without touching code.

### Files

| File | Role |
|---|---|
| `locales/customer/en.json` | Default English values — used to seed the database on first run |
| `src/helpers/staticTextSync.js` | Runs at server startup — scans customer templates for `mt('key')` calls, creates missing DB rows, backfills empty English rows with defaults |
| `src/routes/staticTranslations.js` | API route: `PUT /api/static-translations/:key/:lang` — saves a translation value |
| `src/views/admin/menu-translations.ejs` | Admin page at `/admin/menu-translations` — inline-editable table of all static keys |
| `public/admin/js/menu-translations.js` | Debounced auto-save (400ms after typing, immediate on blur) for the translation table |

### How it works

1. On server startup, `staticTextSync` scans all customer EJS files for `mt('key')` patterns to discover every key in use.
2. It compares this list against the `StaticTranslation` table and creates any missing rows (one row per key per enabled language).
3. English rows with no value are backfilled from `locales/customer/en.json`.
4. On a customer page request, `menuPages.js` fetches the relevant DB rows and builds an `mt()` function (see Language Detection below).
5. The EJS template calls `mt('some.key')` wherever static text is needed.

### How to edit translations

Go to **Admin → Settings → Manage static text translations**. The table shows every key with a column per language. Click any cell and type — it saves automatically.

### How to add a new static text key

1. Use `mt('your.new.key')` in a customer EJS template.
2. Add the English default to `locales/customer/en.json`.
3. Restart the server — `staticTextSync` will detect the new key, create the DB rows, and backfill the English value.
4. The key will appear in the admin translation table for other languages to be filled in.

---

## Layer 3 — Content Data Translations

### What it does

All content that the restaurant creates — menu item names and descriptions, category names, allergen labels, dietary tag names, course names, set menu titles, set menu dish notes — is stored with a translations sub-table per model.

### Database structure

Each content model has a companion translations table, e.g.:

```
MenuItem          → MenuItemTranslation  (menu_item_id, lang, name, description)
Category          → CategoryTranslation  (category_id, lang, name, description, public_notes)
AllergenTag       → AllergenTagTranslation (allergen_tag_id, lang, name)
...
```

### How it works

The admin forms for each content type have one tab per enabled language. The restaurant fills in names and descriptions for each language. The data is stored as separate rows — one per language.

When the customer menu loads, a `pickT(translations, lang)` function selects the best available translation using the fallback chain:

```
requested language → Spanish (es) → English (en) → first available
```

### How to update content translations

Go to the relevant admin page (Menu Items, Categories, Tags, etc.), open the item, and fill in the translation tabs for each language.

---

## Language Detection — Customer Pages

When a customer visits `/menu`, the server picks their language using this priority order:

1. `?lang=xx` query parameter in the URL (e.g. a language button was clicked)
2. Browser `Accept-Language` header — the first 2 characters of each code are matched (so `en-IE`, `en-GB` all become `en`; `es-MX`, `es-419` all become `es`)
3. First language in the restaurant's `enabled_languages` list

Only languages that are enabled for the restaurant are considered. If the browser language is not in the enabled list, it falls back to the first enabled language.

### Translation fallback chain

If a translation is missing for the detected language, the system tries:

```
Detected language → Spanish (es) → English (en) → key name (last resort)
```

This applies to both `mt()` (static text) and `pickT()` (content data).

---

## Language Detection — Admin Pages

The admin UI language is controlled by the `ui_lang` cookie. It defaults to English and is changed by clicking the language selector. This also controls which language is shown first in content tables and forms (e.g. which translation of a menu item name is displayed in the items list).

---

## Enabled Languages

The list of languages available on the customer menu is configured in **Admin → Settings → Languages**. English and Spanish are locked and cannot be removed. Additional languages can be added up to the account maximum.

When a language is added, `staticTextSync` will create empty `StaticTranslation` rows for it on the next server restart. Content translation rows for the new language are created as the restaurant fills them in through the admin forms.

---

## Files Reference

```
locales/
  admin/
    en.json                          Admin UI — English strings
    es.json                          Admin UI — Spanish strings
  customer/
    en.json                          Customer static text — English defaults

src/
  helpers/
    i18n.js                          Loads admin locale files, builds t()
    staticTextSync.js                Syncs customer mt() keys to the database
  middleware/
    loadSettings.js                  Attaches t(), uiLang to every admin request
  routes/
    menuPages.js                     Customer page routes — detectLang(), buildMt(), pickT()
    staticTranslations.js            API: save a static translation value
  views/
    admin/
      menu-translations.ejs          Admin UI: edit customer static text
    customer/
      partials/
        lang-selector.ejs            Language switcher buttons on customer pages
        topbar.ejs                   Fixed topbar that hosts the lang selector

public/
  admin/
    js/
      menu-translations.js           Auto-save logic for the translation table
```
