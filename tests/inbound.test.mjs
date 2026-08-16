import crypto from 'crypto';
import { SERVER, tally } from './harness.mjs';

const SECRET = 'whsec_' + Buffer.from('a'.repeat(32)).toString('base64');
process.env.RESEND_API_KEY = 'test_key';
process.env.RESEND_WEBHOOK_SECRET = SECRET;
process.env.FORWARD_TO = 'inbox@gmail.com';
process.env.FORWARD_FROM = 'Nehemiah Mail <noreply@nehemiahapps.com>';
process.env.PORT = '4182';
process.env.HOST = '127.0.0.1';

const EMAIL_ID = '11111111-2222-4333-8444-555555555555';
const calls = [];
const realFetch = globalThis.fetch;

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (u.includes('api.resend.com')) {
    calls.push({ url: u, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    if (u.includes(`/emails/receiving/${EMAIL_ID}`)) {
      return new Response(JSON.stringify({
        id: EMAIL_ID,
        from: 'customer@example.com',
        to: ['support@nehemiahapps.com'],
        received_for: ['support@nehemiahapps.com'],
        subject: 'Question about my store',
        html: '<p>Hi, when can you start?</p>',
        text: 'Hi, when can you start?',
        created_at: '2026-08-15T14:00:00.000Z',
        attachments: [],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (u.endsWith('/emails')) {
      return new Response(JSON.stringify({ id: 'fwd-1' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  }
  return realFetch(url, init);
};

await import(SERVER);
await new Promise(r => setTimeout(r, 300));
const BASE = 'http://127.0.0.1:4182';

const { check, done } = tally();

// Sign exactly the way Svix does.
function sign(body, { id = 'msg_test', ts = Math.floor(Date.now() / 1000), secret = SECRET } = {}) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const sig = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${sig}` };
}

const event = JSON.stringify({
  type: 'email.received',
  created_at: '2026-08-15T14:00:00.000Z',
  data: { email_id: EMAIL_ID, from: 'customer@example.com', to: ['support@nehemiahapps.com'], subject: 'Question about my store', attachments: [] },
});

const post = (body, headers) => realFetch(BASE + '/api/inbound', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body,
});

console.log('\n--- signature verification ---');
let r = await post(event, {});
check('rejects missing signature headers', r.status === 401, `got ${r.status}`);

r = await post(event, { 'svix-id': 'x', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,bogus' });
check('rejects wrong signature', r.status === 401, `got ${r.status}`);

r = await post(event, sign(event, { secret: 'whsec_' + Buffer.from('b'.repeat(32)).toString('base64') }));
check('rejects signature from a different secret', r.status === 401, `got ${r.status}`);

r = await post(event, sign(event, { ts: Math.floor(Date.now() / 1000) - 4000 }));
check('rejects replay of an old timestamp', r.status === 401, `got ${r.status}`);

r = await post(event + ' ', sign(event));
check('rejects a tampered body', r.status === 401, `got ${r.status}`);

console.log('\n--- forwarding ---');
calls.length = 0;
r = await post(event, sign(event));
check('accepts a correctly signed event', r.status === 200, `got ${r.status}`);

const lookup = calls.find(c => c.url.includes('/emails/receiving/'));
check('fetches the full email by id', !!lookup, JSON.stringify(calls.map(c => c.url)));
check('uses /emails/receiving/{id}', lookup?.url.endsWith(`/emails/receiving/${EMAIL_ID}`), lookup?.url);

const send = calls.find(c => c.method === 'POST' && c.url.endsWith('/emails'));
check('sends a forward', !!send);
check('  from is the verified domain', send?.body.from === 'Nehemiah Mail <noreply@nehemiahapps.com>', send?.body.from);
check('  to is the forwarding mailbox', JSON.stringify(send?.body.to) === '["inbox@gmail.com"]', JSON.stringify(send?.body.to));
check('  reply_to is the original sender', send?.body.reply_to === 'customer@example.com', send?.body.reply_to);
check('  subject preserved', send?.body.subject === 'Question about my store', send?.body.subject);
check('  original body carried through', send?.body.html?.includes('when can you start'), send?.body.html?.slice(0, 80));
check('  banner names the real sender', send?.body.html?.includes('customer@example.com'));

console.log('\n--- retry safety ---');
calls.length = 0;
r = await post(event, sign(event, { id: 'msg_retry' }));
const body = await r.json();
check('duplicate delivery is not forwarded twice', r.status === 200 && body.duplicate === true && !calls.some(c => c.method === 'POST'), JSON.stringify(body));

console.log('\n--- other event types ---');
const other = JSON.stringify({ type: 'email.delivered', data: { email_id: 'x' } });
r = await post(other, sign(other));
check('ignores unrelated event types', r.status === 200, `got ${r.status}`);

r = await realFetch(BASE + '/api/inbound');
check('GET is rejected', r.status === 405, `got ${r.status}`);

console.log('\n--- contact form still works ---');
r = await realFetch(BASE + '/contact');
check('contact page still serves', r.status === 200, `got ${r.status}`);

done();
