# Hedgile

Hedgile helps metal trading teams run purchasing and sales contracts, call-offs, deliveries, lots, quality and hedging in one place, with market prices and master data behind them. Laimon, the built-in assistant, reads documents into drafts the user checks before anything is saved.

It is one **Cloudflare Worker** (`hedgileapp`): a **React Router 7** app whose pages and server code deploy together, with **D1** for data and **R2** for files.

**Why TypeScript:** Hedgile is a web application (sign-in, menus, forms, tables), so one language across browser and server keeps the stack small. Strict TypeScript catches mistakes in quantities, prices and dates at compile time, and Zod checks the same rules at runtime wherever data enters the app. It runs on Cloudflare Workers, which run JavaScript/TypeScript natively; nothing in the product needs Python.

## Features

- **Organisations and sign-in**: sign in with LaimonID only; each organisation's data is isolated; users are `admin` or `user`; seed organisation Hedgile.
- **Menu**: Market Data, Process (Purchasing, Sales, Quality, Hedging), Master Data and Settings in the spec's order; locked entries show a lock and open nothing; Metals lists one entry per active metal reference.
- **Shared UI kit**: type-ahead dropdowns that match any part of the value, card lists with plus (create) and pencil (edit), locks, light red backtrading rows, KNOWN / LAST KNOWN badges.
- **Master data**: companies and materials, created and edited per organisation.
- **Settings**: organisation name and base currency; invite members by email and change their role.
- **Laimon panel**: on every page; chat, or drop a PDF to get a draft with a confidence per field, edit it, and save only after confirming. The PDF is attached to the record created, and the extraction is in the audit trail.
- **Provenance**: every stored or calculated figure records its trigger (market, quantity, quality, pricing conditions, manual), automatic or manual, who and when, plus the formula with its actual inputs; click a figure (`ProvenanceValue`) to see "Why this value". Read it at `GET /api/provenance`.
- **Deploy**: every push to `main` deploys to production (other branches are not deployed); `pnpm db:reset:remote` puts the demo organisation back to its start state.
- **Health check**: `GET /health` reports whether the Worker and its database are up.

## Install, run, test, build

Requires Node 22 (see `.nvmrc`) and pnpm 9.

```bash
pnpm install
cp .env.example .dev.vars             # then fill in the values (see below)
pnpm db:migrate:local                 # create the local D1 database
pnpm db:reset:local                   # load the demo start state
pnpm dev                              # http://localhost:5173
```

| Command                                            | What it does                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                                         | Run the app locally in the Workers runtime, with local D1 and R2                    |
| `pnpm lint`                                        | ESLint                                                                              |
| `pnpm typecheck`                                   | Generate route types, then `tsc`                                                    |
| `pnpm test`                                        | Vitest: unit tests, component tests and the end-to-end main flow                    |
| `pnpm build`                                       | Production build into `build/`                                                      |
| `pnpm start`                                       | Serve the production build locally with `wrangler dev`                              |
| `pnpm cf-typegen`                                  | Regenerate `worker-configuration.d.ts` after changing `wrangler.jsonc`              |
| `pnpm db:migrate:local` / `pnpm db:migrate:remote` | Apply `migrations/` to the local / deployed database                                |
| `pnpm db:reset:local` / `pnpm db:reset:remote`     | Reset the demo organisation to the start state                                      |
| `pnpm deploy`                                      | Build, migrate and deploy from your machine (normally Cloudflare does this on push) |

Local sign-in needs a LaimonID client that allows `http://localhost:5173/auth/callback` as a redirect URI.

## Settings

Plain settings are `vars` in `wrangler.jsonc`; secrets are set in the Cloudflare dashboard (Worker **hedgileapp** > Settings > Variables and Secrets) or with `pnpm exec wrangler secret put NAME`. Locally, all of them go in `.dev.vars` (git-ignored; template with safe example values in `.env.example`). They are checked on the first request; a missing or invalid one shows a page naming it.

| Setting                  | Kind   | Description                                                                     |
| ------------------------ | ------ | ------------------------------------------------------------------------------- |
| `APP_ENV`                | var    | `development`, `test` or `production` (production uses secure cookies)          |
| `LOG_LEVEL`              | var    | `error`, `warn`, `info`, `debug` or `trace`                                     |
| `LAIMONID_ISSUER`        | var    | LaimonID's OpenID Connect issuer URL                                            |
| `LAIMONID_CLIENT_ID`     | var    | Hedgile's client id at LaimonID                                                 |
| `LAIMONID_CLIENT_SECRET` | secret | Hedgile's client secret at LaimonID                                             |
| `SESSION_SECRET`         | secret | Signs session cookies; at least 32 random characters (`openssl rand -hex 32`)   |
| `BOOTSTRAP_ADMIN_EMAILS` | var    | Comma-separated emails that join organisation Hedgile as admin on first sign-in |
| `ANTHROPIC_API_KEY`      | secret | Claude API key for Laimon; leave unset to switch Laimon off                     |
| `LAIMON_MODEL`           | var    | Claude model Laimon uses (default `claude-opus-5-5`)                            |

## Deploy

Cloudflare Workers Builds deploys the Worker **hedgileapp** from this repository.

One-time setup in the Cloudflare dashboard:

1. **Storage & Databases > D1 > Create**: name it `hedgile-db`, then put its **database ID** in `wrangler.jsonc` (`d1_databases[0].database_id`) and push.
2. **R2 > Create bucket**: name it `hedgile-attachments`.
3. **Workers & Pages > hedgileapp > Settings > Builds**: connect `thomasvermeire/hedgile` with
   - production branch: `main`
   - build command: `pnpm run build`
   - deploy command: `pnpm exec wrangler d1 migrations apply DB --remote && pnpm exec wrangler deploy`
   - builds for non-production branches: **off** (other branches are not deployed)
4. **Settings > Variables and Secrets**: add the secrets above, and set `LAIMONID_ISSUER`, `LAIMONID_CLIENT_ID` and `BOOTSTRAP_ADMIN_EMAILS` (in `wrangler.jsonc` or the dashboard).
5. At LaimonID, allow `https://<your hedgileapp URL>/auth/callback` as a redirect URI.

After that, a merge to `main` is live in a few minutes. Only `main` is deployed; check other branches locally with `pnpm dev`.

## Project structure

```
workers/app.ts          Worker entry
wrangler.jsonc          Worker name, bindings (D1, R2), vars
migrations/             D1 schema
db/reset-demo.sql       Demo start state
src/routes.ts           URL map
src/routes/             One file per route
src/auth/               LaimonID sign-in, sessions, request guard
src/tenancy/            Organisations, memberships, roles
src/navigation/         Menu and icons
src/ui/                 Shared UI kit
src/master-data/        Companies, materials, metal references, attachments
src/settings/           Organisation settings and members
src/laimon/             Laimon panel, Claude calls, drafts
src/config/env.ts       Settings validation
src/utils/              Logger, validation, form helpers
src/test/               Test doubles and the end-to-end main-flow test
```

See `AGENTS.md` for the conventions every change follows.
