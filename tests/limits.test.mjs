import { SERVER, tally } from './harness.mjs';

process.env.RESEND_API_KEY = 'test_key';
process.env.PORT = '4185';
process.env.HOST = '127.0.0.1';
process.env.INTAKE_RATE_MAX = '50';
// Small caps so the boundaries can be exercised quickly.
process.env.INTAKE_MAX_BODY_BYTES = String(2 * 1024 * 1024);       // 2 MB
process.env.INTAKE_MAX_ATTACHMENT_BYTES = String(512 * 1024);      // 512 KB
process.env.INTAKE_MAX_FILES = '3';

const realFetch = globalThis.fetch;
let sends = 0;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes('api.resend.com')) {
    sends++;
    return new Response(JSON.stringify({ id: 'x' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, init);
};

await import(SERVER);
await new Promise(r => setTimeout(r, 300));
const BASE = 'http://127.0.0.1:4185';

const { check, done } = tally();
const post = (body) => realFetch(BASE + '/api/intake', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

const who = { intake_field_1: 'Brand', intake_field_3: 'Person', intake_field_4: 'a@b.com' };
// 'A'.repeat(n) base64-decodes to roughly n * 3/4 bytes.
const b64 = (bytes) => 'A'.repeat(Math.ceil(bytes * 4 / 3));

console.log('\n--- body size ---');
let r = await post({ fields: who, files: [{ field: 'intake_field_12', filename: 'a.bin', content: 'A'.repeat(3 * 1024 * 1024) }] });
check('body over cap -> 413 with the folder-link hint', r.status === 413 && (await r.json()).error.includes('folder-link'), `got ${r.status}`);

r = await post('{ this is not json');
check('malformed body -> 400, not 413', r.status === 400, `got ${r.status}`);

console.log('\n--- attachment size ---');
sends = 0;
r = await post({ fields: who, files: [{ field: 'intake_field_12', filename: 'a.bin', content: b64(700 * 1024) }] });
check('attachments over cap -> 413', r.status === 413, `got ${r.status}`);
check('  nothing sent to Resend', sends === 0, `sends=${sends}`);
check('  message names the MB limit', (await r.json()).error.includes('MB'));

console.log('\n--- file count ---');
r = await post({
  fields: who,
  files: Array.from({ length: 5 }, (_, i) => ({ field: 'intake_field_12', filename: `f${i}.bin`, content: 'QUJD' })),
});
check('too many files -> 400', r.status === 400, `got ${r.status}`);

console.log('\n--- within limits still works ---');
sends = 0;
r = await post({ fields: who, files: [{ field: 'intake_field_12', filename: 'ok.bin', content: b64(100 * 1024) }] });
check('under all caps -> 200', r.status === 200, `got ${r.status}`);
check('  one email sent', sends === 1, `sends=${sends}`);

console.log('\n--- rate limit ---');
let codes = [];
for (let i = 0; i < 3; i++) codes.push((await post({ fields: who })).status);
check('repeated submissions still accepted under cap', codes.every(c => c === 200), codes.join(','));

done();
