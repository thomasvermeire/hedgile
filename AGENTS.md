# AGENTS.md

How to work in this repository — for coding agents, and for people too.

<!-- laimonade:standards:begin v1 -->
<!-- Laimonade keeps this section: any change to it is replaced on the next coding run. Write project notes under "This project" below. -->
## Laimonade standards

Every change in this repository follows these rules. Where anything else in this file disagrees, these win.

### Commands
Node (package.json at the root):
- Install: `pnpm install` — pnpm-lock.yaml stays committed; never add another package manager's lockfile
- Lint: `pnpm run lint`
- Type check: `pnpm run typecheck`
- Test: `pnpm test`
- Build: `pnpm run build`, when package.json has a `build` script

Python (pyproject.toml or requirements.txt, no package.json):
- Install: `pip install -r requirements.txt -r requirements-dev.txt`, or `pip install -e ".[dev]"` with a pyproject.toml
- Lint: `ruff check .`
- Type check: `mypy .`
- Test: `pytest`

CI (`.github/workflows/ci.yml`) runs these on every push and pull request. Run them yourself before you finish: a change that fails one is not done.

### Code
- TypeScript in strict mode, with no `any` and no `@ts-ignore` — or, in Python, type hints on every function and mypy passing.
- Code lives under `src/`, grouped by feature; each unit test sits next to the code it tests.
- Validate input where it enters the app (API routes, forms, queues), and handle and log errors one consistent way.
- Configuration comes from environment variables, validated when the app starts and listed with safe example values in `.env.example`.
- Follow the conventions already in the code; keep each change to what its task asks.

### Tests
- Every change adds or updates the tests for what it changes; a bug fix starts with a test that fails without it.
- At least one test runs the main user flow end to end. Keep it passing.
- Never skip, delete or weaken a test, a lint rule or a type check to make a command pass.

### Docs
- README.md: keep the Features section current — one short entry per feature — and keep the install, run and test steps and the environment variables true.
- AGENTS.md: when a change adds a decision, a domain term or a gotcha, or changes the stack or the folder layout, update "This project" below. Most changes need no edit here.

### Never
- Edit, move or delete `.github/workflows/ci.yml`: Laimonade maintains it.
- Commit a secret, a credential or a `.env` file.
- Add a dependency the change does not need.
<!-- laimonade:standards:end -->

## This project

<!-- Kept current by every change that makes it untrue. Short and specific. -->

### Stack
- One Cloudflare Worker (`hedgileapp`) serves everything: React Router 7 in framework mode (React 19 pages plus server loaders/actions) and the static assets. Built with Vite 8 and `@cloudflare/vite-plugin`.
- Data: Cloudflare D1 (SQLite) bound as `DB`; files: R2 bound as `ATTACHMENTS`. Both in `wrangler.jsonc`.
- Sign-in: email and password (PBKDF2-SHA256 via Web Crypto, `src/auth/password.ts`); signed cookie sessions. LaimonID is planned for later.
- Laimon: Claude API (`@anthropic-ai/sdk`, model in `LAIMON_MODEL`, server-side refusal fallback on).
- TypeScript strict, Zod 4 for every input, Vitest 5 (+ Testing Library/jsdom for components), ESLint 9 + typescript-eslint, Prettier, pnpm 9, Node 22.

### Layout
- `workers/app.ts` — the Worker entry; hands requests to React Router with `context.cloudflare.env`.
- `src/routes.ts` — every URL. `src/routes/*` — one file per route (thin: check input, call a feature module, return).
- `src/root.tsx`, `src/entry.server.tsx` — HTML shell, error page, streaming render.
- Feature folders, each with its tests next to it:
  - `src/auth/` — password hashing, session cookies, own password change, `requireTenant` (the guard every signed-in route calls first).
  - `src/tenancy/` — organisations, memberships, roles, sign-in (`signIn`, lockout, bootstrap admin).
  - `src/navigation/` — the menu (spec order, locked entries) and its icons.
  - `src/ui/` — shared UI kit: `Combobox`, `CardList`, `Lock`, `KnownBadge`, `rowClassName`, `Field`.
  - `src/units/` — pure unit conversion (kg, lb, mt) and exact decimal arithmetic with rounding; the Units settings page.
  - `src/master-data/`, `src/settings/` — the first screens' data access.
  - `src/posting/` — system date / posting date rules (`postingDateSchema`, `isBackdated`, `today`) and the organisation's test mode.
  - `src/provenance/` — why a value is what it is: `provenanceStatement` (record in the write's batch), `getProvenance`, Zod entry, `renderCalculation`; API at `src/routes/api.provenance.ts`.
  - `src/laimon/` — the Laimon panel, Claude calls, extraction kinds, drafts.
  - `src/versioning/` — the app version (`package.json` plus the build commit, injected by Vite `define`) and the typed release list behind `/releases`.
  - `src/config/env.ts` — the Worker settings, validated with Zod.
  - `src/db/` — ids and the audit trail.
  - `src/test/` — test doubles: D1 on Node's SQLite with the real migrations, in-memory R2, the end-to-end main-flow test.
- `src/settings/sections.ts` + `src/routes/settings-layout.tsx` — the Settings sub-menu; each section is `src/routes/settings.<section>.tsx`.
- `migrations/` — D1 schema, applied in order (`pnpm db:migrate:*`). `0006_settings_foundations.sql` holds the shared F3 schema (metals, book metals and periods, reference source types, publication calendars, quality stages, organisation parameters) and seeds organisation Hedgile. `db/reset-demo.sql` — the demo start state.

### Decisions
- Frontend and backend in one Worker and one repo (team choice, 21/11). Keep business rules in feature modules (`*.server.ts`) that do not import React Router, and keep routes thin, so an API can be split out later without rewriting logic.
- Tenancy: every organisation-owned table has `organisation_id`, and every query on it goes through a function that takes a `Tenant` and filters on it. Never query those tables with an id alone. `src/tenancy/isolation.test.ts` checks each new read/write from a second organisation; extend it when you add one.
- Sign-in is email and password for now (team choice, 21/11: LaimonID later). The first admin comes from the `BOOTSTRAP_ADMIN_EMAIL`/`BOOTSTRAP_ADMIN_PASSWORD` secrets; admins add members with an initial password. An admin can never set the password of an account that is also in another organisation. 5 wrong passwords lock an account for 15 minutes; replies never say whether an email exists. A password change bumps `users.session_version`, which signs out older sessions. Membership is re-checked on every request.
- Laimon never writes figures itself: extraction produces a draft (value, confidence, evidence per field) the user edits and confirms; only then is the object created, with the PDF attached and the extraction and confirmation in `audit_log`.
- Posting dates: every transaction table (contracts, receipts, analyses, invoices, quotes, prices) has `system_date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))` and `posting_date TEXT NOT NULL` (ISO `YYYY-MM-DD`, UTC). Validate input with `postingDateSchema({ testMode: await getTestMode(tenant) })` (defaults to today, past allowed, future refused outside test mode), use `PostingDateField` in forms, `PostingDates` for display, and `rowClassName({ backtrading: isBackdated(...) })` for list rows.
- Provenance: every stored or calculated figure records provenance in the same batch as the write (`provenanceStatement`), and is shown with `ProvenanceValue`. Formulas are stored as readable text plus named inputs, never evaluated.
- Releases: a release is cut by adding its entry (changes from Laimonade's done items) at the top of `src/versioning/releases.ts` and bumping `package.json` `version` to match, in the same merge to `main`; a test checks the two agree. The Worker never calls Laimonade.
- Logging: always through `createLogger()` in `src/utils/logger.ts`, never `console.*` directly (ESLint enforces it).
- Quantities and values: convert with `src/units` (`convert`, exact decimals, no floats) and round only at the end of a calculation (`roundQuantity` 5 decimals, `roundValue` 2, half up). Never round intermediate steps.
- Menu entries without a module open a placeholder page; locked entries have no path at all.

### Domain terms
- **Organisation** (tenant): a customer company using Hedgile; seed organisation is **Hedgile** (`org_hedgile`), also the demo tenant.
- **Membership / role**: a user in an organisation as `admin` (settings, members) or `user`.
- **Metal reference**: a published price series for a metal (e.g. LME Nickel Cash); Market Data > Metals lists one entry per active reference.
- **KNOWN / LAST KNOWN**: a price published for that date / the latest earlier price used because that date has none yet.
- **Backtrading line**: a line entered with a date in the past; shown light red (`rowClassName({ backtrading: true })`).
- **System date**: when a transaction row was written (`system_date`); set by the database, never edited.
- **Posting date**: the date a transaction counts for (`posting_date`); defaults to today, earlier dates are backdated, later dates need test mode.
- **Test mode**: an organisation setting (`organisations.test_mode`, admin only, audited) that allows future posting dates; shown as a badge in the top bar.
- **Provenance**: the record of why a value is what it is: trigger, automatic or manual, who, when, and for calculated values the formula with its inputs (`value_provenance`, append-only; the newest row is current).
- **Trigger**: what caused a value: `market`, `quantity`, `quality`, `pricing_conditions` or `manual`.
- **Draft** (Laimon): what Laimon read from a document, waiting for the user to confirm.

### Gotchas
- After changing `wrangler.jsonc`, run `pnpm cf-typegen` and commit `worker-configuration.d.ts`. Secrets are typed in `src/env.d.ts`.
- Route types come from `react-router typegen` (`pnpm typecheck` runs it); import them from `./+types/<route>`.
- Workers are not Node: no `fs`, no `process.env` at runtime. Settings come from `context.cloudflare.env`.
- Settings the team changes in the dashboard must be secrets: `wrangler deploy` overwrites plain vars with `wrangler.jsonc`.
- PBKDF2 in Workers is capped at 100 000 iterations; do not raise `ITERATIONS` in `src/auth/password.ts`.
- D1 `batch()` is atomic; use it when several writes must succeed together (e.g. a record plus its audit entry).
- Only `main` is deployed (team choice, 21/11: no branch previews). Check a branch locally with `pnpm dev`.
- Prettier skips AGENTS.md (see `.prettierignore`): Laimonade replaces the standards section exactly as written.
