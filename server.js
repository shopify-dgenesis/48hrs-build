#!/usr/bin/env node
'use strict';

/*
 * Nehemiah 48hrs-build — static host + contact endpoint.
 *
 * Serves the landing page and exposes POST /api/contact, which relays a
 * submission to support@nehemiahapps.com through Resend. The Resend key lives
 * here and never reaches the browser.
 *
 * Requires Node 18+ (uses the built-in global fetch). No npm dependencies.
 *
 *   RESEND_API_KEY=re_xxx node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = __dirname;

const CONFIG = {
  // 3000 is taken by another app on the shared VPS; 4048 is this site's lane.
  port: Number(process.env.PORT) || 4048,
  host: process.env.HOST || '127.0.0.1',
  resendKey: process.env.RESEND_API_KEY || '',
  from: process.env.CONTACT_FROM || 'Nehemiah <noreply@nehemiahapps.com>',
  to: (process.env.CONTACT_TO || 'support@nehemiahapps.com').split(',').map(s => s.trim()).filter(Boolean),
  // Behind nginx the socket address is the proxy, so read the forwarded header.
  trustProxy: process.env.TRUST_PROXY !== '0',
  maxBodyBytes: 32 * 1024,
  rateMax: Number(process.env.RATE_MAX) || 5,
  rateWindowMs: Number(process.env.RATE_WINDOW_MS) || 10 * 60 * 1000,
};

if (!CONFIG.resendKey) {
  console.warn('[warn] RESEND_API_KEY is not set — /api/contact will return 503 until it is.');
}

/* ============================================================
   FORM SCHEMAS
   The server owns the field list so a crafted request cannot
   inject arbitrary rows into the email we send ourselves.
   ============================================================ */

const FORMS = {
  consultation: {
    label: 'Free Consultation Booking',
    subject: 'New consultation booking',
    fields: [
      { key: 'name',     label: 'Name',                required: true,  max: 120 },
      { key: 'email',    label: 'Email',               required: true,  max: 200, email: true },
      { key: 'business', label: 'Store / Business',    required: true,  max: 200 },
      { key: 'date',     label: 'Preferred date',      required: true,  max: 40 },
      { key: 'time',     label: 'Preferred time',      required: true,  max: 40 },
    ],
  },
  message: {
    label: 'Contact Message',
    subject: 'New contact message',
    fields: [
      { key: 'name',     label: 'Name',             required: true,  max: 120 },
      { key: 'email',    label: 'Email',            required: true,  max: 200, email: true },
      { key: 'business', label: 'Store / Business', required: false, max: 200 },
      { key: 'message',  label: 'Message',          required: true,  max: 5000, multiline: true },
    ],
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(formKey, payload) {
  const schema = FORMS[formKey];
  if (!schema) return { error: 'Unknown form.' };

  const values = {};
  for (const field of schema.fields) {
    const raw = payload[field.key];
    const value = typeof raw === 'string' ? raw.trim().replace(/\r\n/g, '\n') : '';

    if (!value) {
      if (field.required) return { error: `${field.label} is required.` };
      continue;
    }
    if (value.length > field.max) return { error: `${field.label} is too long.` };
    if (field.email && !EMAIL_RE.test(value)) return { error: 'Please enter a valid email address.' };
    values[field.key] = value;
  }
  return { schema, values };
}

/* ============================================================
   EMAIL RENDERING
   ============================================================ */

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function renderEmail(schema, values, meta) {
  const rows = schema.fields
    .filter(f => values[f.key])
    .map(f => {
      const raw = values[f.key];
      const cell = f.multiline
        ? `<div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(raw)}</div>`
        : escapeHtml(raw);
      const linked = f.email
        ? `<a href="mailto:${escapeHtml(raw)}" style="color:#4b7d1f;text-decoration:none">${escapeHtml(raw)}</a>`
        : cell;
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e8ecef;vertical-align:top;
                     font:600 13px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                     color:#5b6770;width:180px;white-space:nowrap">${escapeHtml(f.label)}</td>
          <td style="padding:12px 16px;border-bottom:1px solid #e8ecef;vertical-align:top;
                     font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                     color:#12191d">${linked}</td>
        </tr>`;
    })
    .join('');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6f7">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"
         style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e0e5e8;border-radius:12px;overflow:hidden">
    <tr>
      <td style="padding:20px 24px;background:#0b1418">
        <div style="font:700 16px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#b9f234">
          ${escapeHtml(schema.label)}
        </div>
        <div style="font:400 13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#8fa0a8;margin-top:4px">
          Submitted from ${escapeHtml(meta.page)}
        </div>
      </td>
    </tr>
    <tr><td>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>
    </td></tr>
    <tr>
      <td style="padding:16px 24px;background:#fafbfb;
                 font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#7b8790">
        Received ${escapeHtml(meta.receivedAt)}<br>
        IP ${escapeHtml(meta.ip)}
      </td>
    </tr>
  </table>
</body></html>`;

  const text = [
    schema.label,
    '='.repeat(schema.label.length),
    '',
    ...schema.fields.filter(f => values[f.key]).map(f => `${f.label}: ${values[f.key]}`),
    '',
    `Submitted from ${meta.page}`,
    `Received ${meta.receivedAt}`,
    `IP ${meta.ip}`,
  ].join('\n');

  return { html, text };
}

/* ============================================================
   RATE LIMITING (in-memory, per IP)
   ============================================================ */

const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < CONFIG.rateWindowMs);
  if (recent.length >= CONFIG.rateMax) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    const recent = times.filter(t => now - t < CONFIG.rateWindowMs);
    if (recent.length) hits.set(ip, recent); else hits.delete(ip);
  }
}, CONFIG.rateWindowMs).unref();

/* ============================================================
   CONTACT ENDPOINT
   ============================================================ */

function clientIp(req) {
  if (CONFIG.trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleContact(req, res) {
  const json = (status, body) => {
    const buf = Buffer.from(JSON.stringify(body));
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': buf.length });
    res.end(buf);
  };

  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });
  if (!CONFIG.resendKey) return json(503, { ok: false, error: 'Email is not configured yet.' });

  const ip = clientIp(req);
  if (rateLimited(ip)) return json(429, { ok: false, error: 'Too many submissions. Please try again shortly.' });

  let payload;
  try {
    payload = JSON.parse(await readBody(req, CONFIG.maxBodyBytes));
  } catch {
    return json(400, { ok: false, error: 'Could not read submission.' });
  }
  if (!payload || typeof payload !== 'object') return json(400, { ok: false, error: 'Could not read submission.' });

  // Honeypot: real users never fill a hidden field. Accept silently so bots
  // do not learn they were caught.
  if (typeof payload.website === 'string' && payload.website.trim()) {
    console.log(`[contact] honeypot tripped from ${ip}`);
    return json(200, { ok: true });
  }

  const { schema, values, error } = validate(payload.form, payload);
  if (error) return json(400, { ok: false, error });

  const meta = {
    page: typeof payload.page === 'string' ? payload.page.slice(0, 200) : 'contact',
    receivedAt: new Date().toUTCString(),
    ip,
  };
  const { html, text } = renderEmail(schema, values, meta);
  const who = values.business ? `${values.name} (${values.business})` : values.name;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${CONFIG.resendKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: CONFIG.from,
        to: CONFIG.to,
        reply_to: values.email,
        subject: `${schema.subject} — ${who}`,
        html,
        text,
      }),
    });

    if (!response.ok) {
      // Log the detail server-side; never surface provider errors to the browser.
      console.error('[contact] resend rejected:', response.status, await response.text().catch(() => ''));
      return json(502, { ok: false, error: 'We could not send your message right now. Please email support@nehemiahapps.com directly.' });
    }

    const { id } = await response.json().catch(() => ({}));
    console.log(`[contact] sent ${schema.label} from ${values.email} (${ip}) id=${id || 'n/a'}`);
    return json(200, { ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err.message);
    return json(502, { ok: false, error: 'We could not send your message right now. Please email support@nehemiahapps.com directly.' });
  }
}

/* ============================================================
   STATIC FILES
   ============================================================ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.xml']);
const IMMUTABLE = new Set(['.webp', '.png', '.jpg', '.jpeg', '.woff2', '.ico', '.svg']);
const gzipCache = new Map();

function resolveFile(urlPath) {
  // Reject traversal before touching the filesystem.
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(ROOT, clean);
  if (!filePath.startsWith(ROOT)) return null;

  if (clean === '/' || clean === '\\') filePath = path.join(ROOT, 'index.html');

  let stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  if (stat && stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
    stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
  }
  // Extensionless page URLs: /contact -> contact.html
  if (!stat && fs.existsSync(filePath + '.html')) {
    filePath += '.html';
    stat = fs.statSync(filePath);
  }
  if (!stat || !stat.isFile()) return null;
  return { filePath, stat };
}

function serveStatic(req, res, urlPath) {
  const found = resolveFile(urlPath);
  if (!found) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  const { filePath, stat } = found;
  const ext = path.extname(filePath).toLowerCase();
  const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;

  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    etag,
    'last-modified': stat.mtime.toUTCString(),
    'x-content-type-options': 'nosniff',
  };
  headers['cache-control'] = ext === '.html'
    ? 'no-cache'
    : IMMUTABLE.has(ext)
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=86400, must-revalidate';

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  const wantsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (wantsGzip && COMPRESSIBLE.has(ext)) {
    const key = `${filePath}:${stat.mtimeMs}`;
    let buf = gzipCache.get(key);
    if (!buf) {
      buf = zlib.gzipSync(fs.readFileSync(filePath), { level: 9 });
      gzipCache.clear(); // keep the cache bounded; the site is small
      gzipCache.set(key, buf);
    }
    headers['content-encoding'] = 'gzip';
    headers['content-length'] = buf.length;
    headers.vary = 'Accept-Encoding';
    res.writeHead(200, headers);
    return req.method === 'HEAD' ? res.end() : res.end(buf);
  }

  headers['content-length'] = stat.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

/* ============================================================
   SERVER
   ============================================================ */

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/api/contact') {
    handleContact(req, res).catch((err) => {
      console.error('[contact] unhandled:', err);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end('{"ok":false,"error":"Server error."}');
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain' });
    return res.end('Method not allowed');
  }

  // Keep one canonical URL per page: /contact.html -> /contact
  if (urlPath.endsWith('.html')) {
    const target = urlPath === '/index.html' ? '/' : urlPath.slice(0, -5);
    res.writeHead(301, { location: target });
    return res.end();
  }

  serveStatic(req, res, urlPath);
});

server.listen(CONFIG.port, CONFIG.host, () => {
  console.log(`nehemiah server listening on http://${CONFIG.host}:${CONFIG.port}`);
  console.log(`  contact -> ${CONFIG.to.join(', ')}  from ${CONFIG.from}`);
  console.log(`  resend key ${CONFIG.resendKey ? 'loaded' : 'MISSING'}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
