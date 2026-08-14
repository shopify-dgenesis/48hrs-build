# page.intake-48h standalone extraction

Source template: `templates/page.intake-48h.json`

Rendered reference: `https://b5xdsq48hk0gitwm-74923769934.shopifypreview.com/pages/intake-48h`

The output uses authenticated post-Liquid markup from the rendered Shopify preview, preserving generated selectors, configured colors and measurements, the five-step structure, upload controls, and validation hooks.

| Original source | Approximate source range | Standalone location | Extracted CSS | JavaScript | Status |
|---|---:|---|---|---|---|
| `layout/theme.liquid` | Intake-specific head/layout rules | `form.html` shell | `css/form-global.css` | `js/form.js` | Migrated |
| `sections/nehemiah-header.liquid` | 1–1970 | Header in `form.html` | `css/form-header.css` | `js/form.js` | Migrated |
| `sections/intake-48h.liquid` | 1–2367 | Intake application in `form.html` | `css/form-intake.css` | `js/form.js` | Migrated |

## Preserved visual system

- Dark navy base background
- Top-right lime radial glow
- Bottom-left blue radial glow
- Fixed preparation sidebar on desktop
- Layered panel gradients and borders
- Progress track and completed-step states
- Choice cards, custom radio indicators, and upload tiles
- Validation/error treatments
- Responsive tablet and mobile layout overrides

## Standalone enhancements retained

- Non-file field values are saved in `localStorage`.
- The current step is restored on the same browser/device.
- File selections are intentionally excluded because browsers cannot restore them securely.
- Submission remains presentation-only until a backend is connected.

## Preserved backup

The previous recreation is stored as `backup-recreated/form-recreated.html`, `backup-recreated/css/form-recreated.css`, and `backup-recreated/js/form-recreated.js`.
