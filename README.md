# Hedgile

Hedgile helps small trading teams manage nickel trades from contract to final invoice, giving them a clear view of their daily positions and valuations. It turns scattered trade data into a single place where users can see what they've bought or sold, track payments, and understand their profit or loss at any time.

## Features

### Multi-tenant Organisations
- **Data Isolation**: Each organisation's data is completely isolated from other organisations
- **User Roles**: Users belong to organisations with roles (admin, user)
- **Seed Organisation**: The 'Hedgile' organisation is automatically created on startup

### Authentication
- **LaimonID Sign-in**: Users authenticate exclusively through LaimonID OAuth2
- **Automatic Provisioning**: New users are automatically created and added to the Hedgile organisation on first sign-in
- **JWT Tokens**: Access tokens are issued for authenticated sessions

### API Endpoints
- `POST /api/v1/auth/laimonid/callback` - Exchange LaimonID token for Hedgile access token
- `GET /api/v1/auth/me` - Get current user information
- `GET /api/v1/users/me` - Get current user details
- `GET /api/v1/users/` - List users in current organisation
- `GET /api/v1/organisations/current` - Get current organisation information
- `GET /api/v1/organisations/` - List all organisations the user belongs to
- `GET /health/` - Health check endpoint

## Getting Started

### Prerequisites
- Python 3.11+
- pip

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd hedgile
   ```

2. Install dependencies:
   ```bash
   pip install -e .[dev]
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

   Required environment variables:
   - `LAIMONID_CLIENT_ID` - LaimonID OAuth2 client ID
   - `LAIMONID_CLIENT_SECRET` - LaimonID OAuth2 client secret
   - `SECRET_KEY` - Secret key for JWT token signing
   - `DATABASE_URL` - Database connection URL (default: SQLite)

4. Run the application:
   ```bash
   uvicorn hedgile.main:app --reload
   ```

5. Access the API documentation:
   - Open http://localhost:8000/docs in your browser

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_NAME` | Application name | Hedgile |
| `DEBUG` | Enable debug mode | False |
| `DATABASE_URL` | Database connection URL | sqlite+aiosqlite:///./hedgile.db |
| `LAIMONID_CLIENT_ID` | LaimonID OAuth2 client ID | (required) |
| `LAIMONID_CLIENT_SECRET` | LaimonID OAuth2 client secret | (required) |
| `LAIMONID_AUTHORIZE_URL` | LaimonID authorize endpoint | https://auth.laimonade.com/authorize |
| `LAIMONID_TOKEN_URL` | LaimonID token endpoint | https://auth.laimonade.com/token |
| `LAIMONID_USERINFO_URL` | LaimonID userinfo endpoint | https://auth.laimonade.com/userinfo |
| `SECRET_KEY` | JWT secret key | (required) |
| `ALGORITHM` | JWT algorithm | HS256 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token expiration in minutes | 30 |
| `SEED_ORGANISATION_NAME` | Seed organisation name | Hedgile |

## Running Tests

```bash
pytest tests/ -v
```

Run tests with coverage:
```bash
pytest tests/ --cov=src/hedgile --cov-report=html
```

## Project Structure

```
hedgile/
├── src/
│   └── hedgile/
│       ├── __init__.py
│       ├── main.py              # FastAPI application
│       ├── api/                 # API routers
│       │   ├── __init__.py
│       │   ├── auth.py          # Authentication endpoints
│       │   ├── health.py        # Health check endpoint
│       │   ├── organisations.py # Organisation endpoints
│       │   └── users.py         # User endpoints
│       ├── core/                # Core configuration
│       │   ├── __init__.py
│       │   ├── config.py        # Settings
│       │   ├── database.py      # Database session management
│       │   └── middleware.py    # Middleware
│       ├── models/              # Database models
│       │   ├── __init__.py
│       │   ├── base.py          # Base model
│       │   ├── organisation.py  # Organisation models
│       │   └── user.py          # User model
│       └── schemas/             # Pydantic schemas
│           ├── __init__.py
│           ├── organisation.py
│           └── user.py
│       └── services/            # Business logic services
│           ├── __init__.py
│           ├── auth.py          # Authentication service
│           ├── organisation.py  # Organisation service
│           └── user.py          # User service
├── tests/                       # Tests
│   ├── __init__.py
│   ├── conftest.py             # Test fixtures
│   └── hedgile/
│       └── test_auth.py        # Authentication tests
├── .github/                     # GitHub configuration
│   └── workflows/
│       └── ci.yml              # CI workflow
├── AGENTS.md                   # Agent instructions
├── pyproject.toml              # Project configuration
├── requirements.txt            # Dependencies
└── README.md                   # This file
```

## Architecture

### Multi-tenancy
- **Organisation Model**: Each organisation is a separate tenant with isolated data
- **User-Organisation Association**: Users can belong to multiple organisations with different roles
- **Data Isolation**: All API requests are automatically scoped to the user's current organisation
- **Automatic Provisioning**: New users signing in via LaimonID are automatically added to the Hedgile organisation

### Authentication Flow
1. User signs in via LaimonID OAuth2
2. LaimonID returns an access token
3. Client exchanges LaimonID token for Hedgile token via `/api/v1/auth/laimonid/callback`
4. Hedgile creates or retrieves the user record
5. User is automatically added to the Hedgile organisation (if not already a member)
6. Hedgile issues a JWT access token
7. Client uses Hedgile token for subsequent requests

### Security
- **JWT Tokens**: Signed with a secret key, expire after configurable time
- **Authentication Middleware**: Validates tokens and ensures users have organisation access
- **Role-Based Access**: Users have roles within organisations (admin, user)
- **Data Isolation**: Users can only access data for organisations they belong to

## Acceptance Criteria

The following acceptance criteria are implemented and tested:

1. ✅ Signing in with LaimonID lands the user in organisation Hedgile
2. ✅ A user of another organisation sees no Hedgile data
3. ✅ Unauthenticated requests are refused

## License

This project is proprietary.

## Contributing

See AGENTS.md for development guidelines.
