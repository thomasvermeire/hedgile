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
- Sign-in: LaimonID over OpenID Connect (authorization code + PKCE, ID token checked with `jose`); signed cookie sessions.
- Laimon: Claude API (`@anthropic-ai/sdk`, model in `LAIMON_MODEL`, server-side refusal fallback on).
- TypeScript strict, Zod 4 for every input, Vitest 5 (+ Testing Library/jsdom for components), ESLint 9 + typescript-eslint, Prettier, pnpm 9, Node 22.

### Layout
- `workers/app.ts` — the Worker entry; hands requests to React Router with `context.cloudflare.env`.
- `src/routes.ts` — every URL. `src/routes/*` — one file per route (thin: check input, call a feature module, return).
- `src/root.tsx`, `src/entry.server.tsx` — HTML shell, error page, streaming render.
- Feature folders, each with its tests next to it:
  - `src/auth/` — LaimonID OIDC client, session cookies, `requireTenant` (the guard every signed-in route calls first).
  - `src/tenancy/` — organisations, memberships, roles, sign-in resolution.
  - `src/navigation/` — the menu (spec order, locked entries) and its icons.
  - `src/ui/` — shared UI kit: `Combobox`, `CardList`, `Lock`, `KnownBadge`, `rowClassName`, `Field`.
  - `src/master-data/`, `src/settings/` — the first screens' data access.
  - `src/laimon/` — the Laimon panel, Claude calls, extraction kinds, drafts.
  - `src/config/env.ts` — the Worker settings, validated with Zod.
  - `src/db/` — ids and the audit trail.
  - `src/test/` — test doubles: D1 on Node's SQLite with the real migrations, in-memory R2, a fake LaimonID, the end-to-end main-flow test.
- `migrations/` — D1 schema, applied in order (`pnpm db:migrate:*`). `db/reset-demo.sql` — the demo start state.

### Decisions
- Frontend and backend in one Worker and one repo (team choice, 21/11). Keep business rules in feature modules (`*.server.ts`) that do not import React Router, and keep routes thin, so an API can be split out later without rewriting logic.
- Tenancy: every organisation-owned table has `organisation_id`, and every query on it goes through a function that takes a `Tenant` and filters on it. Never query those tables with an id alone. `src/tenancy/isolation.test.ts` checks each new read/write from a second organisation; extend it when you add one.
- Sign-in is LaimonID only. A person joins an organisation by an invitation for their verified email, or by being listed in `BOOTSTRAP_ADMIN_EMAILS` (joins Hedgile as admin). Membership is re-checked on every request.
- Laimon never writes figures itself: extraction produces a draft (value, confidence, evidence per field) the user edits and confirms; only then is the object created, with the PDF attached and the extraction and confirmation in `audit_log`.
- Logging: always through `createLogger()` in `src/utils/logger.ts`, never `console.*` directly (ESLint enforces it).
- Menu entries without a module open a placeholder page; locked entries have no path at all.

### Domain terms
- **Organisation** (tenant): a customer company using Hedgile; seed organisation is **Hedgile** (`org_hedgile`), also the demo tenant.
- **Membership / role**: a user in an organisation as `admin` (settings, members) or `user`.
- **Metal reference**: a published price series for a metal (e.g. LME Nickel Cash); Market Data > Metals lists one entry per active reference.
- **KNOWN / LAST KNOWN**: a price published for that date / the latest earlier price used because that date has none yet.
- **Backtrading line**: a line entered with a date in the past; shown light red (`rowClassName({ backtrading: true })`).
- **Draft** (Laimon): what Laimon read from a document, waiting for the user to confirm.

### Gotchas
- After changing `wrangler.jsonc`, run `pnpm cf-typegen` and commit `worker-configuration.d.ts`. Secrets are typed in `src/env.d.ts`.
- Route types come from `react-router typegen` (`pnpm typecheck` runs it); import them from `./+types/<route>`.
- Workers are not Node: no `fs`, no `process.env` at runtime. Settings come from `context.cloudflare.env`.
- D1 `batch()` is atomic; use it when several writes must succeed together (e.g. a record plus its audit entry).
- Branch previews use the same D1 database and R2 bucket as production.
- Prettier skips AGENTS.md (see `.prettierignore`): Laimonade replaces the standards section exactly as written.
