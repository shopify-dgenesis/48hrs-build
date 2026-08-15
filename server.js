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

  // Inbound forwarding: Resend receives mail for the domain and POSTs an
  // email.received event here; we fetch the content and re-send it to a
  // mailbox a human actually reads. Resend has no built-in forwarding.
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
  forwardTo: (process.env.FORWARD_TO || '').split(',').map(s => s.trim()).filter(Boolean),
  forwardFrom: process.env.FORWARD_FROM || 'Nehemiah Mail <noreply@nehemiahapps.com>',
  // Resend caps a send at 40 MB; base64 inflates by ~33%, so stay well under.
  maxAttachmentBytes: Number(process.env.MAX_ATTACHMENT_BYTES) || 15 * 1024 * 1024,

  // The intake form carries up to 9 uploads, so it needs far more headroom
  // than the contact form. nginx client_max_body_size must allow this too.
  intakeMaxBodyBytes: Number(process.env.INTAKE_MAX_BODY_BYTES) || 30 * 1024 * 1024,
  intakeMaxAttachmentBytes: Number(process.env.INTAKE_MAX_ATTACHMENT_BYTES) || 20 * 1024 * 1024,
  intakeMaxFiles: Number(process.env.INTAKE_MAX_FILES) || 25,
  intakeRateMax: Number(process.env.INTAKE_RATE_MAX) || 3,
};

/* Field labels are derived from form.html so the emailed submission reads like
   the form the customer actually filled in, not "intake_field_37". */
let INTAKE_SCHEMA = [];
try {
  INTAKE_SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'intake-schema.json'), 'utf8'));
} catch (err) {
  console.warn(`[warn] intake-schema.json could not be read (${err.message}) — /api/intake will return 503.`);
}

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
    let overflowed = false;
    const chunks = [];

    req.on('data', (chunk) => {
      // Destroying the socket here would kill the connection before the 413
      // could be written, leaving the caller with a connection reset instead
      // of a message explaining what went wrong. Stop buffering and let the
      // handler answer; nginx buffers the request body ahead of us, so there
      // is nothing meaningful left to drain.
      if (overflowed) return;
      size += chunk.length;
      if (size > limit) {
        overflowed = true;
        chunks.length = 0;
        reject(Object.assign(new Error('body too large'), { code: 'BODY_TOO_LARGE' }));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => { if (!overflowed) resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', (err) => { if (!overflowed) reject(err); });
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
   INTAKE FORM  (POST /api/intake)

   The 48-hour intake is a five-step, 65-field form with up to
   nine uploads, so it gets its own endpoint: the contact route's
   32 KB body cap could not hold a single logo.
   ============================================================ */

const intakeHits = new Map();

function intakeRateLimited(ip) {
  const now = Date.now();
  const recent = (intakeHits.get(ip) || []).filter(t => now - t < CONFIG.rateWindowMs);
  if (recent.length >= CONFIG.intakeRateMax) { intakeHits.set(ip, recent); return true; }
  recent.push(now);
  intakeHits.set(ip, recent);
  return false;
}

function renderIntakeEmail(values, files, meta) {
  const sectionsHtml = [];
  const textParts = [];

  for (const step of INTAKE_SCHEMA) {
    const rows = [];
    const lines = [];

    for (const field of step.fields) {
      const raw = values[field.name];
      let display;

      if (field.type === 'file') {
        // Uploads carry no text value — name them against the field they answer,
        // so the reader can see which upload was the logo and which the favicon.
        const attached = files.filter(f => f.field === field.name);
        if (!attached.length) continue;
        display = attached
          .map(f => `${f.filename} (${(f.size / 1024).toFixed(0)} KB)`)
          .join(', ');
      } else if (field.type === 'checkbox') {
        if (raw === undefined || raw === null) continue;
        display = raw ? 'Yes' : 'No';
      } else {
        if (raw === undefined || raw === null || raw === '') continue;
        display = String(raw);
        if (!display.trim()) continue;
      }

      lines.push(`${field.label}: ${display}`);
      const multiline = display.includes('\n');
      rows.push(`
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #eef1f3;vertical-align:top;
                     font:600 12px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                     color:#5b6770;width:220px">${escapeHtml(field.label)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #eef1f3;vertical-align:top;
                     font:400 13px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                     color:#12191d"${multiline ? ' style="white-space:pre-wrap"' : ''}>${
                       multiline
                         ? `<div style="white-space:pre-wrap">${escapeHtml(display)}</div>`
                         : escapeHtml(display)
                     }</td>
        </tr>`);
    }

    if (!rows.length) continue;
    sectionsHtml.push(`
      <tr><td style="padding:22px 24px 8px">
        <div style="font:700 13px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                    color:#0b1418;text-transform:uppercase;letter-spacing:.06em">
          Step ${step.step} — ${escapeHtml(step.title)}
        </div>
      </td></tr>
      <tr><td style="padding:0 8px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows.join('')}</table>
      </td></tr>`);
    textParts.push(`\n== Step ${step.step} — ${step.title} ==\n` + lines.join('\n'));
  }

  const attachNote = files.length
    ? `<p style="margin:0;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#3c4a52">
         <strong>${files.length} file(s) attached</strong> — ${escapeHtml(files.map(f => f.filename).join(', '))}</p>`
    : `<p style="margin:0;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#8a949b">No files attached.</p>`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6f7">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"
         style="max-width:760px;margin:0 auto;background:#fff;border:1px solid #e0e5e8;border-radius:12px;overflow:hidden">
    <tr><td style="padding:20px 24px;background:#0b1418">
      <div style="font:700 16px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#b9f234">
        48-Hour Build Intake
      </div>
      <div style="font:400 13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#8fa0a8;margin-top:4px">
        ${escapeHtml(meta.brand || 'New submission')}
      </div>
    </td></tr>
    ${sectionsHtml.join('')}
    <tr><td style="padding:16px 24px;background:#fafbfb;border-top:1px solid #eef1f3">${attachNote}</td></tr>
    <tr><td style="padding:12px 24px 18px;background:#fafbfb;
                   font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#7b8790">
      Received ${escapeHtml(meta.receivedAt)}<br>IP ${escapeHtml(meta.ip)}
    </td></tr>
  </table>
</body></html>`;

  const text = [
    '48-HOUR BUILD INTAKE',
    '====================',
    meta.brand || '',
    ...textParts,
    '',
    files.length ? `Attachments: ${files.map(f => f.filename).join(', ')}` : 'No files attached.',
    `Received ${meta.receivedAt}`,
    `IP ${meta.ip}`,
  ].join('\n');

  return { html, text };
}

async function handleIntake(req, res) {
  const json = (status, body) => {
    const buf = Buffer.from(JSON.stringify(body));
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': buf.length };
    // A rejected upload may still be arriving; close rather than try to reuse.
    if (status === 413) headers.connection = 'close';
    res.writeHead(status, headers);
    res.end(buf);
  };

  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });
  if (!CONFIG.resendKey) return json(503, { ok: false, error: 'Email is not configured yet.' });
  if (!INTAKE_SCHEMA.length) return json(503, { ok: false, error: 'Intake form is not configured.' });

  const ip = clientIp(req);
  if (intakeRateLimited(ip)) {
    return json(429, { ok: false, error: 'Too many submissions. Please try again later.' });
  }

  // Read and parse separately: one catch for both made every malformed body
  // report as "too large", which is a misleading thing to tell a customer.
  let raw;
  try {
    raw = await readBody(req, CONFIG.intakeMaxBodyBytes);
  } catch {
    return json(413, { ok: false, error: 'Your submission is too large. Please use the folder-link fields for big files.' });
  }

  let payload;
  try { payload = JSON.parse(raw); } catch { payload = null; }
  if (!payload || typeof payload !== 'object') return json(400, { ok: false, error: 'Could not read submission.' });

  if (typeof payload.website === 'string' && payload.website.trim()) {
    console.log(`[intake] honeypot tripped from ${ip}`);
    return json(200, { ok: true });
  }

  const submitted = payload.fields && typeof payload.fields === 'object' ? payload.fields : {};

  // Keep only fields the schema knows about, so nothing arbitrary reaches the email.
  const known = new Map();
  for (const step of INTAKE_SCHEMA) for (const f of step.fields) known.set(f.name, f);

  const values = {};
  for (const [name, field] of known) {
    const raw = submitted[name];
    if (raw === undefined || raw === null) continue;
    if (field.type === 'checkbox') { values[name] = Boolean(raw); continue; }
    const str = String(raw).trim().replace(/\r\n/g, '\n');
    if (str) values[name] = str.slice(0, 5000);
  }

  // Minimum viable submission: we must be able to identify and reply to them.
  const brand = values['intake_field_1'];
  const contact = values['intake_field_3'];
  const email = values['intake_field_4'];
  if (!brand || !contact || !email) {
    return json(400, { ok: false, error: 'Brand name, contact name and business email are required.' });
  }
  if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: 'Please enter a valid business email.' });

  // Attachments
  const incoming = Array.isArray(payload.files) ? payload.files : [];
  if (incoming.length > CONFIG.intakeMaxFiles) {
    return json(400, { ok: false, error: `Too many files (max ${CONFIG.intakeMaxFiles}).` });
  }
  const files = [];
  let total = 0;
  for (const item of incoming) {
    if (!item || typeof item.content !== 'string' || !known.has(item.field)) continue;
    let buf;
    try { buf = Buffer.from(item.content, 'base64'); } catch { continue; }
    if (!buf.length) continue;
    total += buf.length;
    if (total > CONFIG.intakeMaxAttachmentBytes) {
      return json(413, {
        ok: false,
        error: `Attachments exceed ${Math.round(CONFIG.intakeMaxAttachmentBytes / 1024 / 1024)} MB. Please share large files using the folder-link fields instead.`,
      });
    }
    files.push({
      field: item.field,
      filename: String(item.filename || 'attachment').slice(0, 120).replace(/[\r\n"]/g, ''),
      size: buf.length,
      content: buf.toString('base64'),
    });
  }

  const meta = { brand, receivedAt: new Date().toUTCString(), ip };
  const { html, text } = renderIntakeEmail(values, files, meta);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${CONFIG.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: CONFIG.from,
        to: CONFIG.to,
        reply_to: email,
        subject: `New 48-hour intake — ${brand} (${contact})`,
        html,
        text,
        attachments: files.length
          ? files.map(f => ({ filename: f.filename, content: f.content }))
          : undefined,
      }),
    });

    if (!response.ok) {
      console.error('[intake] resend rejected:', response.status, await response.text().catch(() => ''));
      return json(502, { ok: false, error: 'We could not submit your intake right now. Please email support@nehemiahapps.com.' });
    }
    const { id } = await response.json().catch(() => ({}));
    console.log(`[intake] sent "${brand}" from ${email} (${ip}) files=${files.length}`
      + ` ${(total / 1024 / 1024).toFixed(1)}MB id=${id || 'n/a'}`);
    return json(200, { ok: true });
  } catch (err) {
    console.error('[intake] send failed:', err.message);
    return json(502, { ok: false, error: 'We could not submit your intake right now. Please email support@nehemiahapps.com.' });
  }
}

/* ============================================================
   INBOUND FORWARDING  (POST /api/inbound)

   Resend Inbound is a pipeline, not a mailbox: it parses received
   mail and POSTs an `email.received` event carrying metadata only.
   This handler verifies the signature, pulls the full message from
   GET /emails/receiving/{id}, and re-sends it to FORWARD_TO.
   ============================================================ */

/* Svix signing, implemented directly so the server stays dependency-free.
   HMAC-SHA256 over "<id>.<timestamp>.<raw body>", key = base64-decoded
   secret after the whsec_ prefix. */
function verifyWebhook(secret, headers, rawBody) {
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatures = headers['svix-signature'];
  if (!id || !timestamp || !signatures) return false;

  // Reject replays of an old capture.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');
  const expectedBuf = Buffer.from(expected);

  // Header holds space-delimited "v1,<sig>" pairs; any match is valid.
  for (const entry of String(signatures).split(' ')) {
    const [version, signature] = entry.split(',');
    if (version !== 'v1' || !signature) continue;
    const candidate = Buffer.from(signature);
    if (candidate.length === expectedBuf.length && crypto.timingSafeEqual(candidate, expectedBuf)) {
      return true;
    }
  }
  return false;
}

// Svix retries on any non-2xx, so remember what we already forwarded.
const forwarded = new Map();
const alreadyForwarded = (id) => {
  const now = Date.now();
  for (const [key, at] of forwarded) if (now - at > 24 * 60 * 60 * 1000) forwarded.delete(key);
  if (forwarded.has(id)) return true;
  forwarded.set(id, now);
  return false;
};

const resendGet = (path) => fetch('https://api.resend.com' + path, {
  headers: { authorization: `Bearer ${CONFIG.resendKey}` },
});

/* "Name <a@b.com>" -> "a@b.com" */
const bareAddress = (value) => {
  const angled = String(value || '').match(/<([^>]+)>/);
  return (angled ? angled[1] : String(value || '')).trim().toLowerCase();
};
const addressDomain = (value) => {
  const bare = bareAddress(value);
  const at = bare.lastIndexOf('@');
  return at === -1 ? '' : bare.slice(at + 1);
};

/* Forwarding to the domain we receive for delivers straight back into this
   webhook, and every hop is a new email_id so de-duplication cannot stop it.
   Refuse the configuration outright rather than let it run away. */
function inboundLoopRisk() {
  const receivingDomain = addressDomain(CONFIG.forwardFrom);
  if (!receivingDomain) return [];
  return CONFIG.forwardTo.filter(target => addressDomain(target) === receivingDomain);
}

async function collectAttachments(email) {
  const list = Array.isArray(email.attachments) ? email.attachments : [];
  const out = [];
  let total = 0;

  for (const item of list) {
    // The download URL field has moved around; accept whichever is present.
    const url = item.url || item.download_url || item.href;
    if (!url) {
      console.warn(`[inbound] attachment "${item.filename}" has no download URL — skipped`);
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (total + buf.length > CONFIG.maxAttachmentBytes) {
        console.warn(`[inbound] attachment "${item.filename}" skipped — would exceed size cap`);
        continue;
      }
      total += buf.length;
      out.push({ filename: item.filename || 'attachment', content: buf.toString('base64') });
    } catch (err) {
      console.warn(`[inbound] attachment "${item.filename}" failed: ${err.message}`);
    }
  }
  return out;
}

async function handleInbound(req, res) {
  const json = (status, body) => {
    const buf = Buffer.from(JSON.stringify(body));
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'content-length': buf.length });
    res.end(buf);
  };

  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed.' });
  if (!CONFIG.resendKey || !CONFIG.webhookSecret || !CONFIG.forwardTo.length) {
    console.error('[inbound] not configured (need RESEND_API_KEY, RESEND_WEBHOOK_SECRET, FORWARD_TO)');
    return json(503, { ok: false, error: 'Inbound forwarding is not configured.' });
  }
  const loops = inboundLoopRisk();
  if (loops.length) {
    console.error(`[inbound] refusing to forward: FORWARD_TO (${loops.join(', ')}) is on the same`
      + ` domain we receive for — that would loop. Point it at an external mailbox.`);
    return json(503, { ok: false, error: 'Inbound forwarding is misconfigured.' });
  }

  // Signature is computed over the exact bytes — never re-serialize first.
  let raw;
  try {
    raw = await readBody(req, 512 * 1024);
  } catch {
    return json(400, { ok: false, error: 'Body too large.' });
  }

  if (!verifyWebhook(CONFIG.webhookSecret, req.headers, raw)) {
    console.warn(`[inbound] rejected: bad signature from ${clientIp(req)}`);
    return json(401, { ok: false, error: 'Invalid signature.' });
  }

  let event;
  try { event = JSON.parse(raw); } catch { return json(400, { ok: false, error: 'Bad JSON.' }); }

  if (event?.type !== 'email.received') {
    return json(200, { ok: true, ignored: event?.type || 'unknown' });
  }

  const emailId = event.data?.email_id;
  if (!emailId) return json(400, { ok: false, error: 'Missing email_id.' });
  if (alreadyForwarded(emailId)) {
    console.log(`[inbound] ${emailId} already forwarded — ignoring retry`);
    return json(200, { ok: true, duplicate: true });
  }

  try {
    const lookup = await resendGet(`/emails/receiving/${emailId}`);
    if (!lookup.ok) {
      forwarded.delete(emailId); // let Svix retry
      console.error(`[inbound] fetch ${emailId} failed: ${lookup.status} ${await lookup.text().catch(() => '')}`);
      return json(502, { ok: false, error: 'Could not fetch the received email.' });
    }
    const email = await lookup.json();

    const sender = email.from || event.data.from || 'unknown sender';

    // Second line of defence: never forward something we ourselves sent.
    if (bareAddress(sender) === bareAddress(CONFIG.forwardFrom)) {
      console.warn(`[inbound] ${emailId} was sent by this server — not forwarding (loop guard)`);
      return json(200, { ok: true, skipped: 'loop' });
    }

    const recipients = [].concat(email.to || event.data.to || []).join(', ');
    const forWhom = [].concat(email.received_for || event.data.received_for || []).join(', ');
    const subject = email.subject || event.data.subject || '(no subject)';

    const banner =
      `Forwarded by nehemiahapps.com\n` +
      `From: ${sender}\n` +
      `To: ${recipients}${forWhom ? `\nReceived for: ${forWhom}` : ''}\n` +
      `Date: ${email.created_at || event.data.created_at || ''}\n`;

    const bannerHtml =
      `<div style="margin:0 0 16px;padding:10px 14px;border-left:3px solid #b9f234;background:#f5f7f2;` +
      `font:13px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#3c4a52">` +
      `<strong>Forwarded by nehemiahapps.com</strong><br>` +
      `From: ${escapeHtml(sender)}<br>To: ${escapeHtml(recipients)}` +
      (forWhom ? `<br>Received for: ${escapeHtml(forWhom)}` : '') +
      `</div>`;

    const attachments = await collectAttachments(email);

    const payload = {
      from: CONFIG.forwardFrom,
      to: CONFIG.forwardTo,
      subject,
      // Reply goes to whoever actually wrote in, not to our own noreply address.
      reply_to: sender,
      html: email.html ? bannerHtml + email.html : undefined,
      text: email.text ? banner + '\n' + email.text : undefined,
    };
    if (!payload.html && !payload.text) payload.text = banner + '\n(no body content)';
    if (attachments.length) payload.attachments = attachments;

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${CONFIG.resendKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!sendRes.ok) {
      forwarded.delete(emailId);
      console.error(`[inbound] forward failed: ${sendRes.status} ${await sendRes.text().catch(() => '')}`);
      return json(502, { ok: false, error: 'Forward failed.' });
    }

    const { id } = await sendRes.json().catch(() => ({}));
    console.log(`[inbound] forwarded "${subject}" from ${sender} -> ${CONFIG.forwardTo.join(', ')}`
      + `${attachments.length ? ` (${attachments.length} attachment(s))` : ''} id=${id || 'n/a'}`);
    return json(200, { ok: true });
  } catch (err) {
    forwarded.delete(emailId);
    console.error('[inbound] error:', err.message);
    return json(502, { ok: false, error: 'Forward failed.' });
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

  if (urlPath === '/api/intake') {
    handleIntake(req, res).catch((err) => {
      console.error('[intake] unhandled:', err);
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end('{"ok":false,"error":"Server error."}');
    });
    return;
  }

  if (urlPath === '/api/inbound') {
    handleInbound(req, res).catch((err) => {
      console.error('[inbound] unhandled:', err);
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
  console.log(`  intake   ${INTAKE_SCHEMA.length
    ? `${INTAKE_SCHEMA.reduce((n, s) => n + s.fields.length, 0)} fields across ${INTAKE_SCHEMA.length} steps`
    : 'DISABLED (intake-schema.json missing)'}`);
  const loops = inboundLoopRisk();
  if (loops.length) {
    console.error(`  inbound  MISCONFIGURED — FORWARD_TO (${loops.join(', ')}) is on `
      + `${addressDomain(CONFIG.forwardFrom)}, the domain Resend receives for.`);
    console.error(`           Forwarding there loops back into this webhook forever.`);
    console.error(`           Set FORWARD_TO to an external mailbox (Gmail, Outlook, ...).`);
  } else {
    console.log(`  inbound  ${CONFIG.webhookSecret && CONFIG.forwardTo.length
      ? `-> ${CONFIG.forwardTo.join(', ')}`
      : 'disabled (set RESEND_WEBHOOK_SECRET + FORWARD_TO)'}`);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
