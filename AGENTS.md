# Ads2Wallet / Nudj — Apple Wallet CRM Platform

## What this is

Multi-tenant SaaS: brands run loyalty programs via Apple Wallet passes (`.pkpass`) and related flows. Back office dashboard for templates, passes, push, campaigns, analytics. Members get a store-card style pass with updates.

## Stack

- **Runtime**: Node.js 20+ / Express (`src/server.js`)
- **Database**: PostgreSQL (`pg`), schema auto-applied on boot via `getDb()` in `src/db/index.js`
- **Hosting**: **Railway** (Nixpacks builder, auto-deploy from `main`); PostgreSQL via Railway plugin
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

- `DATABASE_URL` — PostgreSQL connection string (Railway auto-sets when DB is attached)
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

## Deploy on Railway

1. Create a **Railway** project and connect the GitHub repo (branch `main`).
2. Add **PostgreSQL** (Railway plugin); `DATABASE_URL` is injected when the DB is attached to the service.
3. **Nixpacks** builds the app (`railway.json`: `npm install`, start `node src/server.js`).
4. **Env vars**: set `CUSTOM_DOMAIN`, `JWT_SECRET`, Apple/Resend/Google keys as needed. For a dedicated HR studio host (e.g. `studio.filodiretto.app`), set `CUSTOM_DOMAIN` to that hostname; optional `DASHBOARD_PRODUCT_TITLE` for white-label chrome; point only the `studio.*` DNS at this app (root domain can host a separate marketing site).
5. Custom domain → point DNS → HTTPS handled by Railway.
6. **Health check**: HTTP GET `/health` (configured in `railway.json`).

**Redeploy**: `git push origin main` triggers auto-deploy.

### Proxy / HTTPS

`server.js` uses `trust proxy` so `req.protocol` and HTTPS redirects work behind Railway’s reverse proxy.

### Ephemeral filesystem

Railway’s filesystem is ephemeral — redeploys wipe `/tmp`. `.pkpass` generation may use `/tmp`; **downloads regenerate** on demand. No long-term reliance on generated files on disk.

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
| **Titolo** | **22** | Maiuscolo sulla strip |
| **Messaggio** | **66** | 3 righe × 22 caratteri sulla strip |
| **Testo notifica Wallet (`screen_alert`)** | **178** | Lock screen iPhone — **obbligatorio** |

Copy breve; emoji e punteggiatura contano. URL lunghi → **Includi link nel pass**, non nel messaggio. Anteprima in `fd-push.js` usa gli stessi limiti.

## 🔒 Push Wallet HR — invarianti bloccate (NON MODIFICARE)

Meccanismo validato su iPhone reale (luglio 2026). Blindato da `scripts/push-wallet-lock.test.js`: **se un test LOCK fallisce, la modifica è vietata** salvo approvazione esplicita del proprietario del repo.

1. **Notifica lock screen** = campo FRONT `announcement` (auxiliary) con `changeMessage: '%@'` e `value` = testo `screen_alert` + token invisibile. iOS ignora `changeMessage` senza `%@`; i back field aggiornano in silenzio; l'header è inaffidabile.
2. **`screen_alert` obbligatorio** (max 178) su `/push/send` e `/push/scheduled`; persiste su `scheduled_push.screen_alert`; scheduler e W.AI lo derivano da `titolo: messaggio` quando assente.
3. **`relevantDate` mai sui pass HR** — causa la notifica generica "Carta punto vendita modificata".
4. **Icona notifica quadrata** (`wallet_icon`) come unico brand mark per email/portal/hub (`/mark`); email senza allegato logo quando esiste URL HTTPS.
5. **Link retro senza titolo duplicato**: titolo solo in `attributedValue`, `value` = `\u200b`.

Prima di toccare `employee-pass.js`, `passkit.js`, `push-dispatch.js`, `pass-push-state.js`, `scheduler.js`, `push-text-limits.js` o i pannelli push della dashboard: eseguire `node scripts/push-wallet-lock.test.js`.

## Testing

Smoke test after deploy:

1. Dashboard loads, login, basic CRUD
2. Pass download / install iOS
3. Push receives update
4. Email via Resend
5. `/debug/sign-test` if enabled

## Repo & GitHub

- **Remote**: `https://github.com/mandriano77-prog/Wallet_Ads` (verify with `git remote -v`)
- **Branch**: merge to **`main`** — `git push origin main` auto-deploys on Railway.

---

`railway.json` configures Nixpacks build, start command, and health check for Railway.
