# What's left on the 48hrs build

Paused 15 Aug 2026, picked back up 16 Aug. The site, both contact forms, the
intake form and inbound mail forwarding are all live and verified in
production. Three things need you before this is finished, and one of them is
the only piece nobody has tested end to end yet.

| | |
| --- | --- |
| Live at | https://build.nehemiahapps.com |
| Deployed commit | `d4f487b` — deployed 16 Aug, 413 fix verified live |
| Undeployed | `8bd0dc9` — tests only, nothing the server runs |
| Tests passing | 87, all green — `cd tests && npm test` |

---

## Start here

Step 1 is done. **Do step 3 before step 2** — if `CONTACT_TO` is wrong, the
intake test in step 2 will look like it worked while the email goes nowhere.

### 1. Deploy the last fix — DONE 16 Aug

`2d2a41a` is live. `git pull` fast-forwarded `cc9c99c..d4f487b` and the service
restarted at 05:06:32.

Verified rather than assumed: an oversized body posted to the live contact
endpoint now answers **400** with
`{"ok":false,"error":"Could not read submission."}`. Before the deploy the same
request answered **502** — the old `req.destroy()` as nginx sees it once the
upstream vanishes.

Re-run that probe any time. `/api/contact` caps bodies at 32 KB and shares the
same `readBody`, so it exercises the fix without touching the intake rate limit
or sending anything (the body never parses). It does cost one of the five
contact submissions allowed per 10 minutes.

```bash
python3 -c "print('{\"form\":\"message\",\"name\":\"x\",\"email\":\"x@y.com\",\"message\":\"' + 'A'*200000 + '\"}')" \
  | curl -sS -X POST -H 'Content-Type: application/json' --data-binary @- \
    -w '\n%{http_code}\n' https://build.nehemiahapps.com/api/contact
```

- [x] Deployed
- [x] Probe returns 400, not 502

### 2. Submit the intake form yourself — UNTESTED IN THE WILD

Go to https://build.nehemiahapps.com/form and fill in all five steps with real
files. Automated tests drove the whole wizard with ten uploads and the live
endpoint is confirmed reachable, but a genuine browser submission with real
files has never been done. This is the last unverified path in the system.

Check that:

- [ ] The email arrives with the attachments actually attached
- [ ] Fields read as labels (`Brand / Store Name`) not `intake_field_1`
- [ ] Each upload is named against its own field (`Logo Files: logo.svg (12 KB)`)

### 3. Confirm contact submissions actually reach Gmail — CHECK THIS FIRST

The deploy log shows this pair, five seconds apart:

```
Aug 15 16:10:26  [contact] sent Contact Message from dagikot182@joystill.com
                           (136.158.123.111) id=73fd30b7-…
Aug 15 16:10:31  [inbound] f4f86359-… was sent by this server
                           — not forwarding (loop guard)
```

That is the contact email landing at `support@nehemiahapps.com`, coming back in
through the inbound webhook, and being refused by the loop guard — correctly,
since the guard compares the sender against `FORWARD_FROM` and both default to
`noreply@nehemiahapps.com`.

**So the support@ copy is a dead end by design.** Submissions only reach you if
your Gmail is listed in `CONTACT_TO` as well. If it isn't, every inquiry is
swallowed silently — the endpoint answers `200`, Resend accepts the send, and
nothing ever arrives. **This applies to the intake form too**: both endpoints
send to `CONTACT_TO`.

The startup log already says where mail goes — the `-n 8` after the restart cut
this line off:

```bash
sudo journalctl -u nehemiah-build -n 30 --no-pager | grep 'contact ->'
```

If that names only `support@nehemiahapps.com`, nothing is reaching you. Fix it
in `.env` — the field is comma-separated, so keeping support@ alongside is fine
and the loop guard will go on quietly dropping that copy:

```bash
sudo nano /var/www/48hrs-build/.env
#   CONTACT_TO=nehemiahapps@gmail.com,support@nehemiahapps.com
sudo systemctl restart nehemiah-build
```

- [ ] `contact ->` names a mailbox you actually read
- [ ] A test submission arrives in Gmail

#### The 15:44 submission — probably you

`dagikot182@joystill.com` looks like a test rather than a customer: the same IP
`136.158.123.111` had sent an unsigned request to `/api/inbound` six minutes
earlier (`16:04:36 [inbound] rejected: bad signature`), and customers do not
poke webhook endpoints. The address is also disposable-mail shaped. Worth a
glance, but do not expect a reply to be owed.

- [ ] Glanced at it, no reply owed

---

## Security housekeeping

### Rotate the Resend API key — EXPOSED

Two keys were pasted into the chat transcript: the original `re_UA1A…` and the
current `re_UmSL…`. Treat both as compromised. Generate a fresh key with
*Sending access*, revoke the other two, then update it in **two places** — this
is the part that's easy to half-finish:

```bash
# 1. the server
sudo nano /var/www/48hrs-build/.env      # RESEND_API_KEY=
sudo systemctl restart nehemiah-build

# 2. Gmail's SMTP password for support@nehemiahapps.com
#    Settings -> Accounts and Import -> Send mail as -> edit info
```

Miss the Gmail one and your replies silently stop sending. Consider a separate
key for Gmail so either can be revoked independently.

- [ ] New key created, old two revoked
- [ ] `.env` updated and service restarted
- [ ] Gmail SMTP password updated

---

## Optional

Nothing here blocks anything.

### Turn on HTTP/2

Still serving HTTP/1.1 — certbot writes `listen 443 ssl;` without it. Given the
asset count, multiplexing is worth having. nginx here is 1.24, so it's a listen
flag rather than the `http2 on;` directive.

```bash
sudo sed -i 's/listen \[::\]:443 ssl;/listen [::]:443 ssl http2;/; s/listen 443 ssl;/listen 443 ssl http2;/' \
  /etc/nginx/sites-available/build.nehemiahapps.com
sudo nginx -t && sudo systemctl reload nginx
```

- [ ] Enabled and `curl -sI https://build.nehemiahapps.com/` reports HTTP/2

### VPS maintenance

The login banner reports **57 pending updates** and **a required system
restart**. A reboot takes every site on the box down briefly — Bloomly,
Markuply, Placely, Shoptimizepro included — so schedule it rather than doing it
half-asleep.

- [ ] Scheduled

---

## Traps worth knowing about

These fail quietly rather than loudly.

**Editing `form.html` breaks the intake email.** Field labels come from
`intake-schema.json`, generated by parsing `form.html`. The server only emits
fields that file knows about — which is also what stops arbitrary keys being
injected into mail you send yourself. Add or rename a field and it *silently*
won't appear in the email until the schema is regenerated. The `intake` suite
fills the whole wizard in a browser and checks the resulting email, so it does
catch this — but only if you run it.

**`FORWARD_TO` must stay an external mailbox.** Pointing it at anything
`@nehemiahapps.com` makes each forward land back in the same webhook, and every
hop is a new `email_id` so de-duplication can't stop it. The server refuses that
configuration at startup — don't work around the guard.

**Port 4048, not 3000.** 3000 belongs to the Shoptimizepro Express backend.
`deploy.sh` only touches its own systemd unit and its own nginx vhost, and
reloads rather than restarts nginx, so the other seven sites stay up.

---

## Limits in force

All overridable in `.env`. Rate limits are per IP per 10 minutes.

| What | Limit | Then what |
| --- | --- | --- |
| Contact form | 5 / 10 min | 429 with a retry message |
| Intake form | 3 / 10 min | 429 — easy to hit while testing |
| Intake uploads | 20 MB | 413 pointing at the Drive-link fields |
| Intake body | 30 MB | 413, must stay under nginx's 32m |
| nginx body | 32m | nginx's own HTML 413 |
| Resend send | 40 MB | hard provider ceiling |
| TLS cert | 13 Nov 2026 | certbot auto-renews |

---

## Already done, for reference

| Area | State |
| --- | --- |
| Page weight | 11.5 MB → 770 KB; WebP images, subsetted WOFF2, one CSS bundle per page |
| HTTPS | Let's Encrypt, auto-renewing, HTTP redirects to HTTPS |
| Contact + consultation | → Resend, Reply-To is the customer — **where it lands is step 3** |
| Intake form | → Resend with attachments, labelled and grouped by step |
| Inbound mail | support@ → Resend Inbound → webhook → Gmail |
| Replying | Gmail sends as support@nehemiahapps.com via smtp.resend.com |
| Other sites | all seven untouched, Shoptimizepro backend still on 3000 |
| Tests | 87 checks now in `tests/` — run `cd tests && npm test` before any deploy |

---

Repo `shopify-dgenesis/48hrs-build` · service `nehemiah-build` ·
logs `journalctl -u nehemiah-build -f` · deploy notes in [DEPLOY.md](DEPLOY.md) ·
tests in [tests/README.md](tests/README.md)
