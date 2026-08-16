# Tests

Four suites covering `server.js`. Each one boots the real server on its own
loopback port and stubs `fetch` for `api.resend.com`, so **no mail is ever
sent** and no API key is needed — the suites set a fake one.

```bash
cd tests
npm install        # also fetches the chromium build Playwright drives
npm test           # all four
node run-all.mjs intake limits    # or just some
```

Run this before deploying. `server.js` has no dependencies of its own; these
live in `tests/package.json` so the repo root stays installable-free.

| Suite | Covers |
| --- | --- |
| `contact` | `/api/contact` validation, honeypot, HTML escaping, oversized bodies, static serving, and both contact forms driven in a real browser |
| `inbound` | `/api/inbound` Svix signature checks, replay rejection, forwarding shape, retry de-duplication |
| `intake` | the whole five-step wizard filled in Chromium with ten uploads, then the resulting email payload — labels, grouping, attachments |
| `limits` | body cap, attachment cap, file count, and that a submission under every cap still sends |

## Two things to know

**They drive the real front end.** `contact` and `intake` use Playwright
against the actual pages, so editing `contact.html` or `form.html` can break
them for the right reason. If `intake` fails after a `form.html` change,
regenerate `intake-schema.json` first — that is the trap documented in
[DEPLOY.md](../DEPLOY.md).

**Exit codes are unreliable on Windows.** After a suite prints its summary and
calls `process.exit`, Node can abort in teardown with
`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` because the server is
still listening. That happens *after* every assertion has run. `run-all.mjs`
therefore reads the printed `N passed, M failed` line rather than the exit
code, and reports a suite that never printed one as `DID NOT FINISH`.
