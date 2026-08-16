import { chromium } from 'playwright';
import { SERVER, tally } from './harness.mjs';

process.env.RESEND_API_KEY = 'test_key_not_real';
process.env.PORT = '4180';
process.env.HOST = '127.0.0.1';
process.env.RATE_MAX = '1000';
process.env.CONTACT_FROM = 'Nehemiah <noreply@nehemiahapps.com>';
process.env.CONTACT_TO = 'support@nehemiahapps.com';

// Intercept the Resend call so nothing leaves this machine.
const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.resend.com')) {
    sent.push({ headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'stub-id-123' }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  }
  return realFetch(url, init);
};

await import(SERVER);
await new Promise(r => setTimeout(r, 300));

const BASE = 'http://127.0.0.1:4180';
const { check, done } = tally();
const post = (body) => realFetch(BASE + '/api/contact', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

console.log('\n--- API validation ---');
let r = await post({ form: 'message', name: 'A', email: 'not-an-email', message: 'hi' });
check('rejects invalid email', r.status === 400, `got ${r.status}`);

r = await post({ form: 'message', name: '', email: 'a@b.com', message: 'hi' });
check('rejects missing name', r.status === 400, `got ${r.status}`);

r = await post({ form: 'consultation', name: 'A', email: 'a@b.com', business: 'B', date: '2026-09-01' });
check('rejects consultation with no time', r.status === 400, `got ${r.status}`);

r = await post({ form: 'nope', name: 'A', email: 'a@b.com' });
check('rejects unknown form', r.status === 400, `got ${r.status}`);

const before = sent.length;
r = await post({ form: 'message', name: 'Bot', email: 'bot@x.com', message: 'spam', website: 'http://spam' });
check('honeypot accepted silently, no email sent', r.status === 200 && sent.length === before, `sent ${sent.length - before}`);

r = await post({ form: 'message', name: 'A', email: 'a@b.com', message: 'x'.repeat(6000) });
check('rejects over-long message', r.status === 400, `got ${r.status}`);

console.log('\n--- oversized body ---');
// Regression guard for 2d2a41a: readBody used to req.destroy() on overflow,
// which killed the socket before the response could be written. Behind nginx
// that surfaced as a 502; here it surfaces as a failed fetch.
try {
  r = await post({ form: 'message', name: 'A', email: 'a@b.com', message: 'A'.repeat(200000) });
  check('body over cap -> answered, not reset', r.status === 400, `got ${r.status}`);
} catch (err) {
  check('body over cap -> answered, not reset', false, `connection died: ${err.message}`);
}

console.log('\n--- HTML injection safety ---');
sent.length = 0;
await post({ form: 'message', name: '<script>alert(1)</script>', email: 'x@y.com', message: 'a < b & c' });
const injected = sent[0].body;
check('escapes script tag in email html', !injected.html.includes('<script>alert(1)</script>') && injected.html.includes('&lt;script&gt;'));
check('escapes ampersand/lt in message', injected.html.includes('a &lt; b &amp; c'));

console.log('\n--- static serving ---');
r = await realFetch(BASE + '/');
check('GET / serves index', r.status === 200 && (await r.text()).includes('48-Hour Shopify Launch'));
r = await realFetch(BASE + '/contact');
check('GET /contact serves contact.html', r.status === 200);
r = await realFetch(BASE + '/contact.html', { redirect: 'manual' });
check('GET /contact.html redirects to /contact', r.status === 301 && r.headers.get('location') === '/contact', `got ${r.status}`);
r = await realFetch(BASE + '/../../../etc/passwd');
check('blocks path traversal', r.status === 404, `got ${r.status}`);
r = await realFetch(BASE + '/css/contact.min.css');
check('serves css gzipped', r.headers.get('content-encoding') === 'gzip', r.headers.get('content-encoding'));
r = await realFetch(BASE + '/assets/fonts/montserrat-400.woff2');
check('fonts get immutable cache header', (r.headers.get('cache-control') || '').includes('immutable'));

console.log('\n--- real browser submission ---');
sent.length = 0;
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
tab.on('pageerror', e => consoleErrors.push(e.message));
await tab.goto(BASE + '/contact', { waitUntil: 'networkidle' });

// --- consultation booking ---
const cf = 'form[data-contact-form="consultation"] ';
await tab.fill(cf + 'input[name="contact[Preferred date]"]', '2026-09-04');
await tab.click(cf + '.consultation-time[data-time-value="2:00 PM"]');
await tab.fill(cf + 'input[name="contact[name]"]', 'Priya Raman');
await tab.fill(cf + 'input[name="contact[email]"]', 'priya@luxeve.co');
await tab.fill(cf + 'input[name="contact[Store / Business Name]"]', 'Luxeve');
await tab.click(cf + 'button[type="submit"]');
await tab.waitForSelector('form[data-contact-form="consultation"] .form-status--success', { timeout: 5000 });
check('consultation shows success state', true);

// --- message form ---
const mf = 'form[data-contact-form="message"] ';
await tab.fill(mf + 'input[name="contact[name]"]', 'Dan Ortiz');
await tab.fill(mf + 'input[name="contact[email]"]', 'dan@northsupply.com');
await tab.fill(mf + 'input[name="contact[Business / Store Name]"]', 'North Supply');
await tab.fill(mf + 'textarea[name="contact[body]"]', 'Need a store built before our Q4 launch.\nCan you start next week?');
await tab.click(mf + 'button[type="submit"]');
await tab.waitForSelector('form[data-contact-form="message"] .form-status--success', { timeout: 5000 });
check('message form shows success state', true);
check('no page errors during submission', consoleErrors.length === 0, consoleErrors.join('; '));

const cleared = await tab.inputValue(cf + 'input[name="contact[name]"]');
check('form resets after success', cleared === '', `got "${cleared}"`);

await browser.close();

console.log('\n--- captured emails ---');
check('two emails sent', sent.length === 2, `got ${sent.length}`);
for (const { headers, body } of sent) {
  check('  auth header uses the key', headers.authorization === 'Bearer test_key_not_real');
  check('  from is noreply@nehemiahapps.com', body.from === 'Nehemiah <noreply@nehemiahapps.com>');
  check('  to is support@nehemiahapps.com', JSON.stringify(body.to) === '["support@nehemiahapps.com"]', JSON.stringify(body.to));
  check('  has html and text parts', !!body.html && !!body.text);
}
const [booking, message] = sent.map(s => s.body);
check('booking subject names the person', booking.subject === 'New consultation booking — Priya Raman (Luxeve)', booking.subject);
check('booking reply_to is the submitter', booking.reply_to === 'priya@luxeve.co');
check('booking carries date + time', booking.text.includes('2026-09-04') && booking.text.includes('2:00 PM'), booking.text);
check('message subject names the person', message.subject === 'New contact message — Dan Ortiz (North Supply)', message.subject);
check('message reply_to is the submitter', message.reply_to === 'dan@northsupply.com');
check('message body preserved with newline', message.text.includes('Can you start next week?'));

console.log('\n--- sample email (plain text) ---');
console.log(booking.text.split('\n').map(l => '  | ' + l).join('\n'));

done();
