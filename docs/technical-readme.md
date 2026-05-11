# Technical README

Developer reference for implementation decisions, system architecture notes, and things to remember when working on this codebase.

---

## Cookie Consent System

### Overview

The cookie consent system is built into the customer-facing menu pages (`/menu/*`). It is **disabled by default** and activates automatically when a `GA_MEASUREMENT_ID` environment variable is present. There is nothing to change in the code to enable or disable it for a client instance.

### How to Enable for a Client

Add one line to the client's `.env` file:

```
GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Remove or leave it blank to disable. The banner will not appear and GA will not load if this variable is absent.

### Files Involved

| File | Role |
|---|---|
| `src/views/customer/partials/cookie-banner.ejs` | Banner UI + all consent logic + GA loader |
| `src/views/customer/index.ejs` | Includes the banner partial (bottom of body) |
| `src/views/customer/club-join.ejs` | Includes the banner partial (bottom of body) |
| `src/views/customer/legal.ejs` | Includes the banner partial; is also linked from the banner text |
| `public/customer/css/menu.css` | `.cookie-banner` and `.cookie-btn` styles |

### Consent Logic

- Consent state is stored in **`localStorage`** under the key `cookie_consent`.
- Possible values: `'accepted'` | `'declined'`
- On every page load, the banner partial checks `localStorage`:
  - `'accepted'` → GA loads immediately, banner stays hidden
  - `'declined'` → GA never loads, banner stays hidden
  - No value → banner is shown
- **Accept**: sets `localStorage` to `'accepted'`, dismisses banner, loads GA
- **Decline**: sets `localStorage` to `'declined'`, dismisses banner, GA never loads
- To reset a user's consent (e.g. for testing), clear `localStorage` in browser DevTools and reload

### Google Analytics Loading

GA is loaded **dynamically and asynchronously** after consent — it is never present in the page source. The `gtag` script is injected into `<head>` at runtime only after `acceptCookies()` is called. `anonymize_ip: true` is set by default.

### Restyling for a Client

All banner styles are in `public/customer/css/menu.css` under the `/* ── Cookie Consent Banner ──` section. They use the same CSS variables as the rest of the menu theme, so they will inherit any colour/font changes made to the base theme automatically.

### Legal Page

- Route: `/menu/legal`
- Template: `src/views/customer/legal.ejs`
- Linked from the footer of all customer pages and from the cookie banner text
- Content: Spanish first, then English. Covers LSSICE art. 10 (owner identification), GDPR/LOPDGDD data protection notice for Gourmet Club member data, cookie policy, intellectual property, and governing law (Spain)
- `restaurantName` is rendered dynamically from the database — no hardcoded restaurant names in the template

### Adding New Customer Pages

Any new customer-facing page should include the cookie banner partial at the bottom of the body, before `</body>`:

```ejs
<%- include('./partials/cookie-banner') %>
```

If the new page is in a subdirectory, adjust the relative path accordingly.

---

*More sections to be added.*
