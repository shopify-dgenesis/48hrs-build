# page.contact-48h standalone extraction

Source template: `templates/page.contact-48h.json`

Rendered reference: `https://b5xdsq48hk0gitwm-74923769934.shopifypreview.com/pages/contact-48h`

The output uses authenticated post-Liquid markup from the rendered Shopify preview. Configured values, generated selectors, original inline SVGs, canvas hooks, and section interaction hooks are preserved.

| Original source | Approximate source range | Standalone location | Extracted CSS | JavaScript | Status |
|---|---:|---|---|---|---|
| `layout/theme.liquid` | Contact-specific head and layout rules | `contact.html` shell | `css/contact-global.css` | `js/contact.js` | Migrated |
| `sections/nehemiah-header.liquid` | 1–1970 | Header in `contact.html` | `css/contact-header.css` | `js/contact.js` | Migrated |
| `sections/nehemiah-contact-hero.liquid` | 1–1319 | Hero in `contact.html` | `css/contact-hero.css` | `js/contact.js` | Migrated with configured static background and vignette |
| `sections/nehemiah-contact-consultation.liquid` | 1–1095 | Booking form in `contact.html` | `css/consultation.css` | `js/contact.js` | Migrated; delivery remains placeholder-only |
| `sections/nehemiah-contact-methods.liquid` | 1–823 | Methods strip in `contact.html` | `css/contact-methods.css` | `js/contact.js` | Migrated |
| `sections/nehemiah-contact-message.liquid` | 1–1072 | Message/timeline in `contact.html` | `css/contact-message.css` | `js/contact.js` | Migrated; delivery remains placeholder-only |
| `sections/trusted-by-entrepreneurs-stats.liquid` | 1–878 | Trust stats in `contact.html` | `css/contact-stats.css` | `js/contact.js` | Migrated |
| `sections/custom-footer-menus.liquid` | 1–1831 | Footer in `contact.html` | `css/contact-footer.css` | `js/contact.js` | Migrated |

## Runtime dependencies

- Dawn base styles: local `css/base.css`
- Montserrat weights 400–800: local `assets/fonts/`
- Icons: original inline SVGs
- Hero background: configured static dark teal treatment with the original vignette. No raster image is configured, and Shopify's `enable_webgl_background` setting remains `false`.
- Forms: visual/validation behavior retained, remote delivery intentionally disabled

## Preserved backup

The previous recreation is stored as `backup-recreated/contact-recreated.html`, `backup-recreated/css/contact-recreated.css`, and `backup-recreated/js/contact-recreated.js`.
