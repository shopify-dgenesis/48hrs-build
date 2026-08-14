# page.mockup-2 standalone extraction

Source template: `templates/page.mockup-2.json`

Rendered reference: `https://b5xdsq48hk0gitwm-74923769934.shopifypreview.com/pages/nehemiah-48hours-shopify`

The standalone output uses the authenticated, post-Liquid markup from the rendered Shopify preview. This preserves configured values, generated section IDs, inline SVGs, and the original component hooks.

| Original source | Approximate source range | Standalone HTML | Extracted CSS | JavaScript | Assets | Status |
|---|---:|---|---|---|---|---|
| `layout/theme.liquid` | 254–1055, 1064–1095 | Page shell and motion canvas insertion | `css/global.css` | `js/main.js` | Generated flow-field canvas | Migrated |
| `sections/nehemiah-header.liquid` | 1–1970 | Header portion of `index.html` | `css/header.css` | `js/main.js` | Original inline SVG mark/icons | Migrated |
| `sections/shopify-48-hour-launch.liquid` | 1–3146 | Hero portion of `index.html` | `css/hero.css` | `js/main.js` | Main render, price icon, three avatars, inline SVGs | Migrated |
| `sections/process-scroll.liquid` | 1–2475 | Process portion of `index.html` | `css/process.css` | `js/main.js` | Four process images | Migrated |
| `sections/included-features.liquid` | 1–2281 | Features portion of `index.html` | `css/features.css` | `js/main.js` | Original inline SVG icon set | Migrated |
| `sections/pricing-packages.liquid` | 1–2469 | Pricing portion of `index.html` | `css/pricing.css` | `js/main.js` | Original inline SVGs | Migrated |
| `sections/client-feedback.liquid` | 1–1284 | Testimonials portion of `index.html` | `css/testimonials.css` | `js/main.js` | Three local avatars | Migrated |
| `sections/launch-faq.liquid` | 1–1681 | FAQ portion of `index.html` | `css/faq.css` | `js/main.js` | Original inline SVG controls | Migrated |
| `sections/launch-contact.liquid` | 1–1660 | Contact CTA portion of `index.html` | `css/contact-section.css` | `js/main.js` | Original inline SVG arrow | Migrated; submission remains placeholder-only |
| `sections/custom-footer-menus.liquid` | 1–1831 | Footer portion of `index.html` | `css/footer.css` | `js/main.js` | Original fallback brand mark and SVG arrows | Migrated |
| Shopify Dawn base stylesheet | Rendered theme asset | N/A | `css/base.css` | N/A | N/A | Downloaded locally |
| Montserrat 400–800 | Header font dependency | N/A | Local `@font-face` rules in `css/global.css` | N/A | `assets/fonts/` | Packaged locally |

## Local raster assets

- `ChatGPT_Image_Aug_11_2026_07_14_37_PM.png`
- `ChatGPT_Image_Aug_11_2026_07_55_20_PM.png`
- `ChatGPT_Image_Aug_11_2026_08_36_10_PM.png`
- `ChatGPT_Image_Aug_11_2026_10_09_53_PM.png`
- `ChatGPT_Image_Aug_11_2026_08_35_53_PM.png`
- `ChatGPT_Image_Aug_11_2026_08_36_03_PM.png`
- `image_54.png`
- `image_55.png`
- `image_56.png`

## Preserved backup

The previous recreation is stored in `backup-recreated/` and is not loaded by the new landing page.
