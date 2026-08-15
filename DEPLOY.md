# Deploying to the VPS — build.nehemiahapps.com

`server.js` does two jobs: it serves the static site (gzip, caching, extensionless
URLs) and exposes `POST /api/contact`, which relays the two contact forms to
`support@nehemiahapps.com` via Resend. It has **no npm dependencies** — only
Node 18+ (for the built-in `fetch`).

## This is a shared box

`72.62.250.147` already runs other things, and the deploy is built to leave them
alone:

| What | Where | Status |
| --- | --- | --- |
| Shoptimizepro backend (Express) | port **3000** | untouched — that's why we use **4048** |
| Other vhosts (`app`, `aof`, `bloomly`, `markuply`, …) | nginx | untouched |
| Shopify app scaffold on `build.nehemiahapps.com` | nginx vhost | **replaced** by this site |

`deploy.sh` only ever writes its own systemd unit (`nehemiah-build`) and its own
nginx vhost for `build.nehemiahapps.com`. It **reloads** nginx instead of
restarting it, so no other site drops a connection, and it backs up the previous
vhost to `/root/nehemiah-deploy-backup-<timestamp>/` before replacing it.

It aborts rather than damaging anything if: port 4048 is taken, Node is older
than 18, `.env` is missing or has no Resend key, the app fails to start, or the
new nginx config does not pass `nginx -t` (in which case it restores the old
vhost automatically).

## Deploy

```bash
# 1. get the code
sudo git clone https://github.com/shopify-dgenesis/48hrs-build.git /var/www/48hrs-build
cd /var/www/48hrs-build

# 2. secrets — .env is gitignored, so it must be created on the server
sudo cp .env.example .env
sudo nano .env            # paste RESEND_API_KEY
sudo chmod 600 .env

# 3. run it
sudo bash deploy.sh
```

Use a different port if 4048 is ever taken:

```bash
sudo PORT=4049 bash deploy.sh
```

## Updating later

```bash
cd /var/www/48hrs-build
sudo git pull
sudo systemctl restart nehemiah-build
```

`.env` is gitignored, so `git pull` never disturbs your key.

Note that `css/*.min.css` and `js/*.min.js` are committed build outputs. If you
edit a source file under `css/` or `js/`, regenerate the matching bundle before
deploying, or the change will not appear on the site.

## Operating it

```bash
systemctl status nehemiah-build
journalctl -u nehemiah-build -f     # every submission logs here
```

On startup it prints whether the Resend key loaded — check that line first if
sending misbehaves.

## Rolling back to the Shopify app

The previous vhost is in `/root/nehemiah-deploy-backup-<timestamp>/`:

```bash
sudo rm /etc/nginx/sites-enabled/build.nehemiahapps.com
sudo cp /root/nehemiah-deploy-backup-<timestamp>/* /etc/nginx/sites-available/
sudo ln -sfn /etc/nginx/sites-available/<old-file> /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl disable --now nehemiah-build
```

## Resend

`nehemiahapps.com` is **verified** in Resend (region `ap-northeast-1`), and both
forms have been confirmed delivering end-to-end.

If sending ever starts failing, check in this order:

1. `journalctl -u nehemiah-build` — the real provider error is logged here; the
   browser only ever sees a generic message.
2. Resend → Domains — still verified?
3. Resend → API Keys — key still valid and has *Sending access*?

## What the endpoint accepts

`POST /api/contact`, JSON body. The server owns the field list, so unknown keys
are ignored rather than injected into the email.

| `form`         | Fields                                               |
| -------------- | ---------------------------------------------------- |
| `consultation` | `name`, `email`, `business`, `date`, `time`           |
| `message`      | `name`, `email`, `business` (optional), `message`     |

Every request also carries `website` — a honeypot. If it is non-empty the
submission is dropped and still answered `200`, so bots get no signal.

Replies go straight to the customer: `reply_to` is set to the submitter's
address, so hitting Reply in the support inbox answers them directly.

Responses: `200 {"ok":true}` · `400` validation · `429` rate limited ·
`502` Resend refused · `503` no API key configured.

`X-Forwarded-For` matters — the vhost sets it. Without it every submission would
look like it came from `127.0.0.1` and the rate limiter would throttle all
visitors as a single client.
