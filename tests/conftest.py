"""Pytest configuration and fixtures."""

import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from hedgile.core.config import Settings
from hedgile.core.database import get_db, Base
from hedgile.main import app
from hedgile.models.organisation import Organisation, OrganisationUser, UserRole
from hedgile.models.user import User

# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Create test session factory
TestingSessionLocal = sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override get_db to use test database."""
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@pytest.fixture(autouse=True)
def override_settings():
    """Override settings for tests."""
    from hedgile.core import config
    
    config.settings = Settings(
        app_name="Hedgile Test",
        debug=True,
        database_url=TEST_DATABASE_URL,
        secret_key="test-secret-key",
        algorithm="HS256",
        access_token_expire_minutes=30,
        seed_organisation_name="Hedgile",
    )
    yield


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function", autouse=True)
async def setup_test_db():
    """Create and drop tables for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Create an async client for testing."""
    from httpx import AsyncClient as HttpxAsyncClient
    from starlette.testclient import TestClient
    
    app.dependency_overrides[get_db] = override_get_db
    
    # For FastAPI async apps, use TestClient which wraps httpx
    with TestClient(
        app,
        base_url="http://test",
        headers={"Content-Type": "application/json"},
    ) as client:
        yield client


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a database session for tests."""
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        id=uuid4(),
        laimonid=f"laimonid_{uuid4().hex[:8]}",
        email=f"test_{uuid4().hex[:8]}@example.com",
        name="Test User",
        avatar=None,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def test_organisation(db_session: AsyncSession) -> Organisation:
    """Create a test organisation."""
    org = Organisation(
        id=uuid4(),
        name=f"Test Org {uuid4().hex[:8]}",
        description="Test organisation",
        is_active=True,
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest.fixture
async def hedgile_organisation(db_session: AsyncSession) -> Organisation:
    """Create the Hedgile organisation."""
    org = Organisation(
        id=uuid4(),
        name="Hedgile",
        description="The Hedgile platform organisation",
        is_active=True,
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest.fixture
async def test_organisation_user(
    db_session: AsyncSession,
    test_user: User,
    test_organisation: Organisation,
) -> OrganisationUser:
    """Create a test organisation-user association."""
    org_user = OrganisationUser(
        id=uuid4(),
        user_id=test_user.id,
        organisation_id=test_organisation.id,
        role=UserRole.USER,
    )
    db_session.add(org_user)
    await db_session.commit()
    await db_session.refresh(org_user)
    return org_user


@pytest.fixture
def create_test_token():
    """Create a test JWT token."""
    from jose import jwt
    from hedgile.core.config import settings
    from datetime import datetime, timedelta, timezone
    
    def _create_token(user_id: str, email: str, laimonid: str) -> str:
        to_encode = {
            "sub": user_id,
            "email": email,
            "laimonid": laimonid,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
            "iat": datetime.now(timezone.utc),
        }
        encoded_jwt = jwt.encode(
            to_encode,
            settings.secret_key,
            algorithm=settings.algorithm,
        )
        return encoded_jwt
    
    return _create_token
