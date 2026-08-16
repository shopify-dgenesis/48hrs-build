import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { SERVER, tally, tmpDir } from './harness.mjs';

process.env.RESEND_API_KEY = 'test_key';
process.env.CONTACT_TO = 'support@nehemiahapps.com';
process.env.PORT = '4184';
process.env.HOST = '127.0.0.1';
process.env.INTAKE_RATE_MAX = '50';

const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes('api.resend.com')) {
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'intake-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, init);
};

await import(SERVER);
await new Promise(r => setTimeout(r, 300));
const BASE = 'http://127.0.0.1:4184';

// scratch files to upload
const dir = tmpDir('uploads');
writeFileSync(`${dir}/logo.svg`, '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
writeFileSync(`${dir}/favicon.png`, Buffer.from('89504e470d0a1a0a', 'hex'));
writeFileSync(`${dir}/brand.pdf`, '%PDF-1.4 fake');
writeFileSync(`${dir}/products.csv`, 'title,price\nTee,25');
writeFileSync(`${dir}/shot1.png`, Buffer.from('89504e470d0a1a0a', 'hex'));
writeFileSync(`${dir}/shot2.png`, Buffer.from('89504e470d0a1a0a', 'hex'));
writeFileSync(`${dir}/pages.docx`, 'fake docx');
writeFileSync(`${dir}/hero-desktop.png`, Buffer.from('89504e470d0a1a0a', 'hex'));
writeFileSync(`${dir}/hero-mobile.png`, Buffer.from('89504e470d0a1a0a', 'hex'));
writeFileSync(`${dir}/legal.pdf`, '%PDF-1.4 legal');

const { check, done } = tally();

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const errors = [];
tab.on('pageerror', e => errors.push(e.message));
await tab.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await tab.goto(BASE + '/form', { waitUntil: 'networkidle' });

const fill = async (name, value) => {
  const sel = `[name="${name}"]`;
  const el = await tab.$(sel);
  if (!el) { console.log(`   (missing ${name})`); return; }
  const tag = await el.evaluate(n => n.tagName);
  if (tag === 'SELECT') await tab.selectOption(sel, { index: 1 });
  else await tab.fill(sel, value);
};
const next = async () => {
  await tab.click('[data-next-btn]');
  await tab.waitForTimeout(350);
};

console.log('\n--- step 1 ---');
await fill('intake_field_1', 'Luxeve');
await fill('intake_field_2', '');
await fill('intake_field_3', 'Priya Raman');
await fill('intake_field_4', 'priya@luxeve.co');
await fill('intake_field_5', '+1 555 0100');
await fill('intake_field_6', '');
await next();
check('advanced past step 1', await tab.isVisible('[data-step="2"].b48-active'));

console.log('--- step 2 ---');
await fill('intake_field_7', 'luxeve.myshopify.com');
await fill('intake_field_8', '');
await fill('intake_field_9', 'Home, Shop, About, Contact');
await fill('intake_field_10', 'Subscriptions and reviews');
await fill('intake_field_11', 'Loyalty program (phase 2)');
await next();
check('advanced past step 2', await tab.isVisible('[data-step="3"].b48-active'));

console.log('--- step 3 (uploads) ---');
await tab.setInputFiles('[name="intake_field_12"]', `${dir}/logo.svg`);
await tab.setInputFiles('[name="intake_field_13"]', `${dir}/favicon.png`);
await tab.setInputFiles('[name="intake_field_14"]', `${dir}/brand.pdf`);
await fill('intake_field_15', 'https://drive.google.com/brand');
await fill('intake_field_16', '#0B1418');
await fill('intake_field_17', '#B9F234');
await fill('intake_field_18', 'https://example.com — clean grid');
await fill('intake_field_19', 'Sticky header, large hero');
await fill('intake_field_20', 'No stock photography');
await next();
check('advanced past step 3', await tab.isVisible('[data-step="4"].b48-active'));

console.log('--- step 4 ---');
await tab.setInputFiles('[name="intake_field_21"]', `${dir}/products.csv`);
await tab.setInputFiles('[name="intake_field_22"]', [`${dir}/shot1.png`, `${dir}/shot2.png`]);
await tab.setInputFiles('[name="intake_field_23"]', `${dir}/pages.docx`);
await fill('main_menu', 'Shop, New Arrivals, About');
await fill('footer_menu', 'Contact, FAQ, Shipping');
await fill('collection_structure', 'Women — Tops, Dresses');
await fill('navigation_notes', 'Mega menu for Shop');
await tab.setInputFiles('[name="intake_field_24"]', `${dir}/hero-desktop.png`);
await tab.setInputFiles('[name="intake_field_25"]', `${dir}/hero-mobile.png`);
await fill('intake_field_26', 'https://drive.google.com/hero');
await fill('intake_field_27', 'Timeless Style. Modern Living.');
await fill('intake_field_28', 'Shop Now');
await fill('intake_field_29', 'Curated pieces for a considered home.');
await fill('intake_field_30', '/collections/all');
await fill('intake_field_31', 'https://drive.google.com/pages');
await fill('intake_field_32', 'About, Contact, FAQ');
await fill('intake_field_33', 'New Arrivals');
await fill('intake_field_34', 'Signature Tee');
await fill('intake_field_35', 'Size variants');
await next();
check('advanced past step 4', await tab.isVisible('[data-step="5"].b48-active'));

console.log('--- step 5 ---');
await fill('intake_field_36', '');
await fill('intake_field_37', 'United States and Canada');
await fill('intake_field_38', 'Shopify Payments');
await fill('intake_field_39', 'luxeve.co');
await fill('intake_field_40', 'Free shipping over $75');
await tab.setInputFiles('[name="intake_field_41"]', `${dir}/legal.pdf`);
await fill('domain_provider', 'Namecheap');
await fill('domain_status', '');
await fill('dns_owner', 'Priya Raman');
await fill('dns_access', '');
await fill('sender_email', 'orders@luxeve.co');
await fill('support_email', 'support@luxeve.co');
await fill('domain_notes', 'DNS managed in Cloudflare');
await fill('intake_field_42', 'https://drive.google.com/legal');
for (const f of ['intake_field_43', 'intake_field_44', 'intake_field_45', 'intake_field_46']) await fill(f, '');
await tab.fill('[name="intake_field_47"]', '2026-09-20');
await fill('intake_field_48', '9 AM–12 PM EST');
for (const c of ['intake_field_49', 'intake_field_50', 'intake_field_51']) await tab.check(`[name="${c}"]`);

sent.length = 0;
await tab.click('[data-next-btn]');
await tab.waitForSelector('.form-status--success', { timeout: 20000 });
check('submitted successfully', true);
check('no page errors', errors.length === 0, errors.join('; '));
console.log('  status text:', (await tab.textContent('.form-status')).trim());

console.log('\n--- email payload ---');
const mail = sent[0];
check('one email sent', sent.length === 1, `got ${sent.length}`);
check('subject names brand + contact', mail?.subject === 'New 48-hour intake — Luxeve (Priya Raman)', mail?.subject);
check('reply_to is the business email', mail?.reply_to === 'priya@luxeve.co', mail?.reply_to);
check('to is support@', JSON.stringify(mail?.to) === '["support@nehemiahapps.com"]', JSON.stringify(mail?.to));
check('10 attachments carried', mail?.attachments?.length === 10, String(mail?.attachments?.length));
check('multi-file input kept both', mail?.attachments?.filter(a => a.filename.startsWith('shot')).length === 2);
check('labels not raw field names', !mail?.text.includes('intake_field_'), 'raw names leaked');
check('shows human labels', mail?.text.includes('Brand / Store Name: Luxeve'));
check('radio answered by title', /Decision authority: I am the final approver/.test(mail?.text), 'radio missing');
check('checkbox rendered as Yes', /I confirm that the final project scope[^\n]*: Yes/.test(mail?.text), 'checkbox missing');
check('grouped by step', mail?.text.includes('== Step 3 — Brand assets & design direction =='));
check('attachment names listed', mail?.text.includes('logo.svg'));
check('upload shown against its field', /Logo Files: logo.svg/.test(mail?.text), 'file field missing');
check('multi-upload shown against its field',
  /Product & collection images: shot1\.png \(\d+ KB\), shot2\.png \(\d+ KB\)/.test(mail?.text),
  (mail?.text.split('\n').find(l => l.startsWith('Product & collection images')) || 'line absent'));

console.log('\n--- server-side guards ---');
const post = (body) => realFetch(BASE + '/api/intake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
let r = await post({ fields: { intake_field_1: 'X' } });
check('rejects missing contact/email', r.status === 400, `got ${r.status}`);
r = await post({ fields: { intake_field_1: 'X', intake_field_3: 'Y', intake_field_4: 'nope' } });
check('rejects bad email', r.status === 400, `got ${r.status}`);
sent.length = 0;
r = await post({ fields: { intake_field_1: 'X', intake_field_3: 'Y', intake_field_4: 'a@b.com' }, website: 'bot' });
check('honeypot drops silently', r.status === 200 && sent.length === 0);
sent.length = 0;
r = await post({ fields: { intake_field_1: 'X', intake_field_3: 'Y', intake_field_4: 'a@b.com', evil_field: 'injected' } });
check('unknown fields ignored', r.status === 200 && !sent[0]?.text.includes('injected'));
r = await realFetch(BASE + '/api/intake');
check('GET rejected', r.status === 405, `got ${r.status}`);

console.log('\n--- sample email (first 30 lines) ---');
console.log(mail.text.split('\n').slice(0, 30).map(l => '  | ' + l).join('\n'));

await browser.close();
done();
