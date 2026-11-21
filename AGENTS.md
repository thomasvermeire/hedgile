# Hedgile

This project helps small trading teams manage nickel trades from contract to final invoice.

## This project

- **Stack**: Python 3.11+, FastAPI, SQLAlchemy, Pydantic
- **Auth**: LaimonID OAuth2
- **Database**: SQLite (for development), PostgreSQL (for production)
- **Testing**: pytest

## Laimonade standards

laimonade:standards

### Code

- Python code is type-annotated and passes mypy --strict
- Use Pydantic models for request/response validation
- Use SQLAlchemy ORM for database operations
- All database models inherit from a common base with proper typing

### Tests

- Test files are in a `tests/` directory mirroring the source structure
- Use pytest with async support for API tests
- Test authentication, authorization, and business logic separately
- Aim for >80% coverage on new code

### Git

- Main branch is `main`
- Feature branches use the format `user/issue-id` or `user/description`
- Commits are atomic and have descriptive messages
- PRs are reviewed before merging

laimonade:standards

## Domain terms

- **Trade**: A nickel trade transaction (buy or sell)
- **Position**: Current holdings of nickel contracts
- **Valuation**: Current market value of positions
- **Organisation**: A tenant/company that uses Hedgile (e.g., Hedgile itself)
- **User**: A person who belongs to one or more organisations with a specific role

## Gotchas

- All data must be isolated by organisation - users can only see data for organisations they belong to
- LaimonID provides authentication but not authorization - we manage roles and permissions
- The Hedgile organisation is the seed organisation for the platform
