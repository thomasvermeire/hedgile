# Hedgile

Hedgile helps small trading teams manage nickel trades from contract to final invoice, giving them a clear view of their daily positions and valuations. It turns scattered trade data into a single place where users can see what they've bought or sold, track payments, and understand their profit or loss at any time.

## Features

- **Trade Management**: Create, update, and track nickel trades with full lifecycle support
- **Position Tracking**: View daily positions with net quantities and average prices
- **Valuation**: Calculate unrealized and realized P&L for trades and portfolios
- **Environment Configuration**: Validate and manage application settings via environment variables
- **Input Validation**: Validate all inputs at entry points with consistent error handling

## Prerequisites

- Node.js 22.x (see [.nvmrc](.nvmrc))
- pnpm 9.x (see [package.json](package.json))

## Installation

```bash
# Install dependencies
pnpm install
```

## Usage

### Development

```bash
# Run all checks (lint, typecheck, test)
pnpm run lint
pnpm run typecheck
pnpm run test

# Or run them all at once
pnpm run lint && pnpm run typecheck && pnpm run test

# Build the project
pnpm run build

# Run tests in watch mode
pnpm run dev
```

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your configuration. The following variables are supported:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| NODE_ENV | Application environment | `development` | No |
| PORT | Server port | `3000` | No |
| LOG_LEVEL | Logging verbosity | `info` | No |

## Project Structure

```
hedgile/
├── src/
│   ├── config/
│   │   ├── env.ts          # Environment variable validation
│   │   └── env.test.ts     # Environment validation tests
│   ├── types/
│   │   ├── trade.ts        # Domain type definitions
│   │   └── trade.test.ts   # Domain type tests
│   ├── utils/
│   │   ├── validation.ts   # Input validation utilities
│   │   └── validation.test.ts
│   └── index.ts            # Main entry point
├── .env.example            # Example environment variables
├── .node-version           # Node.js version
├── .nvmrc                  # Node.js version for nvm
├── .prettierrc             # Prettier configuration
├── eslint.config.js        # ESLint configuration
├── package.json            # Project metadata and scripts
├── pnpm-lock.yaml          # pnpm lockfile
├── tsconfig.json           # TypeScript configuration
├── tsconfig.test.json      # Test TypeScript configuration
└── vitest.config.ts        # Vitest configuration
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm run lint` | Run ESLint on source files |
| `pnpm run typecheck` | Run TypeScript type checking |
| `pnpm run test` | Run all tests with Vitest |
| `pnpm run build` | Compile TypeScript to JavaScript |
| `pnpm run dev` | Run tests in watch mode |

## Architecture

### Technology Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 22.x
- **Package Manager**: pnpm
- **Testing**: Vitest
- **Linting**: ESLint with @typescript-eslint
- **Formatting**: Prettier
- **Validation**: Zod for schema validation

### Key Principles

1. **Type Safety**: All code is TypeScript with strict mode enabled
2. **Input Validation**: All external inputs are validated using Zod schemas
3. **Error Handling**: Consistent error handling with custom ValidationError class
4. **Testing**: Comprehensive unit tests for all modules
5. **Configuration**: Environment variables validated at startup

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run all checks (`pnpm run lint && pnpm run typecheck && pnpm run test`)
5. Commit your changes (`git commit -m 'Add your feature'`)
6. Push to the branch (`git push origin feature/your-feature`)
7. Open a Pull Request

## License

ISC
