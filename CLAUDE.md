# Ads2Wallet / Nudj — Apple Wallet CRM Platform

## What this is

**Filo_Diretto repo = HR / FiloDiretto dashboard only.** The deploy always serves the HR product line (`boot.js` lock is hardcoded to `hr`). Ads2Wallet lives in a separate repo/deploy.

Multi-tenant SaaS: brands run loyalty programs via Apple Wallet passes (`.pkpass`) and related flows. Back office dashboard for templates, passes, push, campaigns, analytics. Members get a store-card style pass with updates.

## Stack

- **Runtime**: Node.js 20+ / Express (`src/server.js`)
- **Database**: PostgreSQL (`pg`), schema auto-applied on boot via `getDb()` in `src/db/index.js`
- **Hosting**: **DigitalOcean** — App Platform or Droplet (+ optional Managed PostgreSQL); deploy from GitHub (`main` or your release branch)
- **Domain**: public hostname set in **`CUSTOM_DOMAIN`** (no scheme), e.g. `app.example.com` — used for pass `webServiceURL`, landing links, Google Wallet image URLs
- **Pass signing**: OpenSSL `cms -sign` (not node-forge)
- **Push**: APNs HTTP/2 (native Node), JWT auth
- **Email**: Resend (`resend` npm)
- **Images**: Sharp
- **AI strips**: fal / creative stack as configured (`FAL_API_KEY`, etc.)

## Architecture

```
src/
├── server.js          # Express app, middleware, static routes, cron boot
├── api/
│   ├── routes.js      # REST endpoints (monolith)
│   └── debug-sign.js  # /debug/sign-test
├── dashboard/
│   └── index.html     # Admin UI (vanilla JS)
├── landing/
│   └── index.html
├── privacy/
│   └── index.html
├── db/
│   └── index.js       # PostgreSQL pool, DDL, migrations inline
└── engine/
    ├── passkit.js, apns.js, mailer.js, scheduler.js, strip-promo.js, google-wallet.js, …
```

## Key endpoints (see `routes.js`)

Auth, brands, templates, passes, signup, Apple Wallet device protocol, push, analytics, campaigns, Google Wallet signup/callback/status, ecc.

## Environment variables

**Required**

- `DATABASE_URL` — PostgreSQL connection string (DigitalOcean Managed Database or other)
- `PASS_TYPE_IDENTIFIER` — Apple pass type ID
- `TEAM_IDENTIFIER` — Apple Team ID
- `JWT_SECRET` — dashboard/session tokens
- `RESEND_API_KEY` — email
- `CUSTOM_DOMAIN` — production hostname (**without** `https://`)

**Certificates** (Apple signing): repo `certs/*.pem` or `SIGNER_*_BASE64` / `WWDR_CERT_BASE64`

**Google Wallet** (optional): `GOOGLE_WALLET_ISSUER_ID`, service account (`GOOGLE_WALLET_SA_BASE64` or `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON`)

**Optional**: `APNS_ENV`, `FROM_EMAIL`, `FROM_NAME`, `PORT` (default 3000), `FAL_API_KEY`, …

## Development

```bash
npm install
export DATABASE_URL="postgres://..."
npm run dev   # node --watch src/server.js
```

Dashboard: `http://localhost:3000/dashboard`  
Landing: `http://localhost:3000/{brand-slug}`

## Deploy on DigitalOcean

Pick one pattern (both work):

### A) App Platform (managed)

1. Create **PostgreSQL** (Managed Database) or use existing; note connection string → `DATABASE_URL` (often requires TLS).
2. **App** → GitHub repo → branch `main`.
3. **Build command**: `npm install` (or default Nix/npm build).
4. **Run command**: `npm start` or `node src/server.js` (match `package.json`).
5. **Env vars**: set `DATABASE_URL`, `CUSTOM_DOMAIN`, `JWT_SECRET`, Apple/Resend/Google keys as needed. For `studio.filodiretto.app`, set `CUSTOM_DOMAIN` to that hostname; optional `DASHBOARD_PRODUCT_TITLE` for white-label chrome. `DASHBOARD_PRODUCT_LINE` is not required (HR is fixed in code).
6. Attach DB to app or paste `DATABASE_URL` from DB dashboard.
7. Custom domain → point DNS → enable HTTPS (handled by App Platform).
8. **Health check**: HTTP GET `/health` (or `/` behaviour you configure).

Redeploy: push to tracked branch or “Deploy” in UI.

### B) Droplet (VPS)

1. Install Node 20+, `git`, optionally **Nginx** + **Certbot** (Let’s Encrypt).
2. Clone repo, `npm install`, `pm2 start src/server.js` (or systemd unit) with env file (`/etc/...env` — **never commit secrets**).
3. Nginx reverse proxy → `proxy_pass http://127.0.0.1:3000`, forward `Host`, `X-Forwarded-Proto`, `X-Forwarded-For`.
4. `CUSTOM_DOMAIN` = the public hostname users hit (matches TLS cert SAN).
5. Managed Postgres on DO: same `DATABASE_URL` pattern as App Platform.

### Proxy / HTTPS

`server.js` uses `trust proxy` so `req.protocol` and HTTPS redirects work behind Nginx/App Platform load balancers.

### Filesystem

`.pkpass` generation may use `/tmp`; **downloads regenerate** on demand. On a Droplet, `/tmp` clears on reboot — same idea: no long-term reliance on generated files on disk.

## Conventions and gotchas

- **Multi-tenant**: always filter by `brand_id`.
- **Signing**: `openssl cms`; `cleanPem()` strips Bag Attributes.
- **APNs**: `sendPushUpdate(pushToken)` expects a **string** token.
- **Dashboard**: single `index.html`, inline JS.
- **Schema**: incremental `ALTER`/DDL in `getDb()` — no separate migration CLI.
- **Cron**: started from `server.js` (scheduler, strip promo, email recap, etc.).

## Push HR — limiti testo (obbligatori per agent e API)

Le push **non partono** se si superano i limiti (`POST /push/send` → 400). Fonte unica: `src/engine/push-text-limits.js`.

| Campo | Max | Note |
|-------|-----|------|
| **Titolo** | **22** | Maiuscolo sulla strip + notifica Wallet |
| **Messaggio** | **52** | 2 righe × 26 caratteri sulla strip |

Copy breve; emoji e punteggiatura contano. URL lunghi → **Includi link nel pass**, non nel messaggio. Anteprima in `fd-push.js` usa gli stessi limiti.

**Assistente bozza:** `POST /brands/:id/push/draft-copy` con `{ brief }` — l’AI compila titolo/messaggio (e opzionalmente link); il manager rivede l’anteprima e invia con `POST /push/send`. UI: blocco «Assistente copy» nel pannello push immediata (`fd-push.js`).

## Testing

Smoke test after deploy:

1. Dashboard loads, login, basic CRUD
2. Pass download / install iOS
3. Push receives update
4. Email via Resend
5. `/debug/sign-test` if enabled

## Repo & GitHub

- **Remote**: `https://github.com/mandriano77-prog/Wallet_Ads` (verify with `git remote -v`)
- **Branch**: merge to **`main`** for production deploy workflow you configure on DigitalOcean.

---

*Legacy*: `railway.json` may remain in repo for historical tooling; production target is DigitalOcean.
