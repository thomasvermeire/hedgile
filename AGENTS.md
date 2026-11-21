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

<!-- Written by the coding agent on the setup run, and kept current by every change that makes it untrue. Short and specific. -->

### Stack
- TypeScript 5.x in strict mode, Node.js 22.x, pnpm 9.x

- ESLint with @typescript-eslint/recommended and @typescript-eslint/recommended-requiring-type-checking
- Prettier for code formatting
- Vitest for unit and end-to-end testing
- Zod for schema validation and environment variable parsing
### Layout
- `src/` — application code grouped by feature: `config/`, `types/`, `utils/`
- `src/config/` — environment variable schemas and validation
- `src/types/` — domain type definitions (Trade, Position, Valuation, etc.)
- `src/utils/` — shared utilities (validation helpers, error classes)
- Each `.ts` file has a corresponding `.test.ts` file with its unit tests
- `src/index.ts` — main entry point that exports public API

### Decisions
- TypeScript strict mode: catch type errors early and prevent `any` usage
- pnpm: faster, more efficient dependency management with strict lockfile
- Zod for validation: type-safe schema validation that infer Types from schemas
- Vitest over Jest: native ESM support, faster, built-in TypeScript support
- Co-located tests: each module's tests live next to it in the same directory

### Domain terms
- **Trade**: A nickel buy or sell transaction with quantity, price, dates, and status
- **Position**: Daily summary showing bought, sold, and net quantities with average prices
- **Valuation**: Calculation of market value and profit/loss (realized and unrealized)
- **Contract**: Identifier for a trade agreement or contract
- **Counterparty**: The other party in a trade transaction

### Gotchas
- `crypto.randomUUID()` requires Node.js global `crypto` — works in Node 22, may need polyfill in older versions
- ESLint `recommended-requiring-type-checking` rules need TypeScript type info — requires `project` setting in parserOptions
