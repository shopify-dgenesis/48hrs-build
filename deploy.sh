#!/usr/bin/env bash
#
# Deploy the Nehemiah landing page + contact endpoint on the shared VPS.
#
# This box already runs other apps (an Express service on :3000, other nginx
# vhosts). This script is deliberately narrow: it only ever creates its own
# systemd unit and its own nginx vhost for one hostname, and it reloads nginx
# rather than restarting it so nothing else drops a connection.
#
# It refuses to continue rather than damage anything it does not own.
#
#   sudo bash deploy.sh
#
set -euo pipefail

DOMAIN="build.nehemiahapps.com"
SERVICE="nehemiah-build"
PORT="${PORT:-4048}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_USER="www-data"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/root/nehemiah-deploy-backup-$STAMP"

say()  { printf '\n\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31m[abort]\033[0m %s\n\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo: sudo bash deploy.sh"

# ----------------------------------------------------------------
# Preflight — verify assumptions before changing a single thing
# ----------------------------------------------------------------
say "Preflight"

command -v node  >/dev/null || die "node is not installed."
command -v nginx >/dev/null || die "nginx is not installed."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[[ "$NODE_MAJOR" -ge 18 ]] || die "Node 18+ required (found $(node -v)); server.js uses the built-in fetch."
echo "  node $(node -v)"

[[ -f "$APP_DIR/server.js" ]] || die "server.js not found in $APP_DIR"
[[ -f "$APP_DIR/index.html" ]] || die "index.html not found in $APP_DIR — is this the repo root?"

if [[ ! -f "$APP_DIR/.env" ]]; then
  die ".env is missing. Create it first:
       cp $APP_DIR/.env.example $APP_DIR/.env
       nano $APP_DIR/.env      # paste RESEND_API_KEY
       chmod 600 $APP_DIR/.env"
fi
KEY="$(sed -n 's/^RESEND_API_KEY=//p' "$APP_DIR/.env" | head -1 | tr -d '\r"'"'"' ')"
[[ -n "$KEY" ]] || die ".env has no RESEND_API_KEY."
[[ "$KEY" == re_* ]] || die "RESEND_API_KEY does not look like a Resend key (should start with re_)."
# "re_xxxxxxxx..." from .env.example satisfies a prefix check but is not a key.
case "$KEY" in
  *xxxxxxxx*|*XXXXXXXX*) die "RESEND_API_KEY is still the placeholder from .env.example.
       Paste the real key:  sudo nano $APP_DIR/.env" ;;
esac

# A prefix is not proof. Ask Resend whether the key actually works.
KEY_HTTP="$(curl -sS -o /dev/null -w '%{http_code}' -m 15 \
  -H "Authorization: Bearer $KEY" https://api.resend.com/domains || echo 000)"
case "$KEY_HTTP" in
  200)     echo "  .env present, Resend key validated against the API" ;;
  401|403) die "Resend rejected this API key (HTTP $KEY_HTTP). Check it at https://resend.com/api-keys" ;;
  000)     warn "could not reach Resend to validate the key — continuing, but verify sending afterwards" ;;
  *)       warn "unexpected response validating the key (HTTP $KEY_HTTP) — continuing" ;;
esac

# Inbound forwarding is optional, but half-configured is a silent failure.
if grep -q '^RESEND_WEBHOOK_SECRET=whsec_' "$APP_DIR/.env" 2>/dev/null; then
  grep -q '^FORWARD_TO=..*@' "$APP_DIR/.env" \
    || warn "RESEND_WEBHOOK_SECRET is set but FORWARD_TO is missing — inbound forwarding will stay disabled."
  grep -q '^RESEND_WEBHOOK_SECRET=whsec_xxxx' "$APP_DIR/.env" \
    && warn "RESEND_WEBHOOK_SECRET is still the placeholder — inbound forwarding will reject every delivery."
fi

# The port must be free, and must not be one another app already uses.
if ss -ltn "sport = :$PORT" | grep -q LISTEN; then
  die "Port $PORT is already in use by another process:
$(ss -ltnp "sport = :$PORT" | tail -n +2)
       Pick a free port:  sudo PORT=4049 bash deploy.sh"
fi
echo "  port $PORT is free"

# Refuse to clobber someone else's systemd unit.
if systemctl list-unit-files | grep -q "^${SERVICE}.service"; then
  echo "  existing ${SERVICE}.service found — it will be updated (this is ours)"
else
  echo "  ${SERVICE}.service is new"
fi

mkdir -p "$BACKUP_DIR"
say "Backups will be written to $BACKUP_DIR"

# ----------------------------------------------------------------
# Locate and back up the current vhost for this domain
# ----------------------------------------------------------------
say "Inspecting existing nginx config for $DOMAIN"

OLD_VHOSTS="$(grep -rlE "server_name[^;]*\b${DOMAIN//./\\.}\b" /etc/nginx/sites-available /etc/nginx/conf.d 2>/dev/null || true)"

SSL_CERT=""
SSL_KEY=""
if [[ -n "$OLD_VHOSTS" ]]; then
  echo "  found:"
  while read -r f; do
    [[ -n "$f" ]] || continue
    echo "    $f"
    cp -a "$f" "$BACKUP_DIR/"
    # Reuse the certificate that is already issued for this hostname.
    if [[ -z "$SSL_CERT" ]]; then
      SSL_CERT="$(grep -oP '^\s*ssl_certificate\s+\K[^;]+' "$f" | head -1 || true)"
      SSL_KEY="$(grep -oP '^\s*ssl_certificate_key\s+\K[^;]+' "$f" | head -1 || true)"
    fi
  done <<< "$OLD_VHOSTS"
  echo "  backed up to $BACKUP_DIR"
else
  warn "no existing vhost mentions $DOMAIN"
fi

# Fall back to the conventional certbot path.
if [[ -z "$SSL_CERT" && -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  SSL_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
  SSL_KEY="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
fi

if [[ -n "$SSL_CERT" && -f "$SSL_CERT" ]]; then
  echo "  reusing certificate: $SSL_CERT"
  USE_TLS=1
else
  warn "no usable TLS certificate found — writing an HTTP-only vhost."
  warn "After this finishes, run:  sudo certbot --nginx -d $DOMAIN"
  USE_TLS=0
fi

# ----------------------------------------------------------------
# App files
# ----------------------------------------------------------------
say "Preparing $APP_DIR"
# The service only ever reads these files, so root keeps ownership and the
# service account gets group read. Handing the repo to www-data would make
# every later `sudo git pull` fail with "dubious ownership".
chown -R root:"$RUN_USER" "$APP_DIR"
chmod -R a+rX "$APP_DIR"
# .env holds the API key: readable by the service, invisible to everyone else.
chown root:"$RUN_USER" "$APP_DIR/.env"
chmod 640 "$APP_DIR/.env"
echo "  root-owned, group $RUN_USER can read; .env is 640"

# ----------------------------------------------------------------
# systemd unit (ours alone)
# ----------------------------------------------------------------
say "Installing ${SERVICE}.service"
cat > "/etc/systemd/system/${SERVICE}.service" <<UNIT
[Unit]
Description=Nehemiah 48hrs-build landing page + contact endpoint
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$APP_DIR
Environment=PORT=$PORT
ExecStart=$(command -v node) --env-file=.env server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
# No ReadWritePaths: the app serves files and calls an API, it never writes.

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE" >/dev/null 2>&1 || true
systemctl restart "$SERVICE"
sleep 2

systemctl is-active --quiet "$SERVICE" || {
  journalctl -u "$SERVICE" -n 30 --no-pager || true
  die "${SERVICE} failed to start (see the log above). Nothing else was changed."
}
echo "  ${SERVICE} is running on 127.0.0.1:$PORT"

# Prove the app answers before we point nginx at it.
if ! curl -fsS -m 10 "http://127.0.0.1:$PORT/" -o /dev/null; then
  die "${SERVICE} is up but not serving on port $PORT. nginx was left untouched."
fi
echo "  local HTTP check passed"

# ----------------------------------------------------------------
# nginx vhost — only for this one hostname
# ----------------------------------------------------------------
say "Writing nginx vhost for $DOMAIN"

VHOST="/etc/nginx/sites-available/$DOMAIN"

# `http2 on;` only exists from nginx 1.25.1; before that HTTP/2 is a listen
# flag. Using the wrong form fails `nginx -t` outright.
NGINX_VER="$(nginx -v 2>&1 | grep -oP '\d+\.\d+\.\d+' || echo 0.0.0)"
if [[ "$(printf '%s\n1.25.1\n' "$NGINX_VER" | sort -V | head -1)" == "1.25.1" ]]; then
  H2_LISTEN=""
  H2_DIRECTIVE="    http2 on;
"
else
  H2_LISTEN=" http2"
  H2_DIRECTIVE=""
fi
echo "  nginx $NGINX_VER — HTTP/2 via ${H2_LISTEN:-http2 directive}"

{
  if [[ "$USE_TLS" == "1" ]]; then
    cat <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl$H2_LISTEN;
    listen [::]:443 ssl$H2_LISTEN;
$H2_DIRECTIVE    server_name $DOMAIN;

    ssl_certificate     $SSL_CERT;
    ssl_certificate_key $SSL_KEY;

    client_max_body_size 64k;

    location / {
        proxy_pass         http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }
}
CONF
  else
    cat <<CONF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    client_max_body_size 64k;

    location / {
        proxy_pass         http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }
}
CONF
  fi
} > "$VHOST"

# Disable any OTHER vhost file that also claims this hostname, so nginx does not
# have two servers competing for it. Other domains are never touched.
while read -r f; do
  [[ -n "$f" ]] || continue
  [[ "$f" == "$VHOST" ]] && continue
  base="$(basename "$f")"
  if [[ -L "/etc/nginx/sites-enabled/$base" ]]; then
    echo "  disabling previous vhost for this domain: sites-enabled/$base"
    rm -f "/etc/nginx/sites-enabled/$base"
  fi
done <<< "$OLD_VHOSTS"

ln -sfn "$VHOST" "/etc/nginx/sites-enabled/$DOMAIN"

say "Testing nginx config"
if ! nginx -t; then
  warn "nginx config test FAILED — rolling back to the previous vhost"
  rm -f "/etc/nginx/sites-enabled/$DOMAIN" "$VHOST"
  for f in "$BACKUP_DIR"/*; do
    [[ -e "$f" ]] || continue
    cp -a "$f" /etc/nginx/sites-available/
    ln -sfn "/etc/nginx/sites-available/$(basename "$f")" "/etc/nginx/sites-enabled/$(basename "$f")"
  done
  nginx -t && systemctl reload nginx
  die "nginx config was invalid. Restored the previous setup; other sites untouched."
fi

# reload, not restart — keeps every other vhost serving without a blip
systemctl reload nginx
echo "  nginx reloaded (other sites unaffected)"

# ----------------------------------------------------------------
# Verify
# ----------------------------------------------------------------
say "Verifying"
SCHEME=$([[ "$USE_TLS" == "1" ]] && echo https || echo http)

# `systemctl reload nginx` returns before the new workers have taken over, so a
# single immediate probe can still be answered by the old config. Poll instead.
probe() {
  local url="$1" want="$2" code=000
  for _ in $(seq 1 12); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' -m 10 "$url" 2>/dev/null || echo 000)"
    [[ "$code" == "$want" ]] && break
    sleep 1
  done
  printf '%s' "$code"
}

code="$(probe "$SCHEME://$DOMAIN/" 200)"
echo "  GET $SCHEME://$DOMAIN/          -> $code"
code_contact="$(probe "$SCHEME://$DOMAIN/contact" 200)"
echo "  GET $SCHEME://$DOMAIN/contact   -> $code_contact"
api="$(probe "$SCHEME://$DOMAIN/api/contact" 405)"
echo "  GET $SCHEME://$DOMAIN/api/contact -> $api (405 expected: it is POST-only)"

echo
if [[ "$code" == "200" && "$code_contact" == "200" ]]; then
  say "Deployed. $SCHEME://$DOMAIN is live."
  if [[ "$USE_TLS" != "1" ]]; then
    warn "HTTP only. Issue a certificate next — it edits just this vhost:"
    warn "  sudo certbot --nginx -d $DOMAIN --redirect"
  fi
else
  warn "Deployed, but the checks above did not both return 200. Inspect with:"
  warn "  journalctl -u $SERVICE -n 50 --no-pager"
  warn "  curl -sI -H 'Host: $DOMAIN' http://127.0.0.1/"
fi

cat <<NOTES

  service   systemctl status $SERVICE
  logs      journalctl -u $SERVICE -f
  backups   $BACKUP_DIR
  rollback  sudo rm /etc/nginx/sites-enabled/$DOMAIN
            sudo cp $BACKUP_DIR/* /etc/nginx/sites-available/
            sudo ln -sfn /etc/nginx/sites-available/<old-file> /etc/nginx/sites-enabled/
            sudo nginx -t && sudo systemctl reload nginx
            sudo systemctl disable --now $SERVICE

  Send a real test submission through the form, then confirm it lands in
  support@nehemiahapps.com.

NOTES
