"""Tests for database models."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from hedgile.models.organisation import Organisation, OrganisationUser, UserRole
from hedgile.models.user import User
from hedgile.services.organisation import OrganisationService
from hedgile.services.user import UserService


@pytest.mark.asyncio
async def test_create_organisation(db_session: AsyncSession) -> None:
    """Test creating an organisation."""
    org_service = OrganisationService(db_session)
    org = await org_service.create(
        name="Test Org",
        description="Test description",
    )
    
    assert org is not None
    assert org.name == "Test Org"
    assert org.description == "Test description"
    assert org.is_active is True


@pytest.mark.asyncio
async def test_create_user(db_session: AsyncSession) -> None:
    """Test creating a user."""
    user_service = UserService(db_session)
    user = await user_service.create(
        laimonid="test_laimonid",
        email="test@example.com",
        name="Test User",
    )
    
    assert user is not None
    assert user.laimonid == "test_laimonid"
    assert user.email == "test@example.com"
    assert user.name == "Test User"


@pytest.mark.asyncio
async def test_add_user_to_organisation(db_session: AsyncSession) -> None:
    """Test adding a user to an organisation."""
    org_service = OrganisationService(db_session)
    user_service = UserService(db_session)
    
    # Create organisation
    org = await org_service.create(name="Test Org")
    
    # Create user
    user = await user_service.create(
        laimonid="test_laimonid",
        email="test@example.com",
    )
    
    # Add user to organisation
    org_user = await org_service.add_user_to_organisation(
        user_id=user.id,
        organisation_id=org.id,
        role=UserRole.USER,
    )
    
    assert org_user is not None
    assert org_user.user_id == user.id
    assert org_user.organisation_id == org.id
    assert org_user.role == UserRole.USER
    
    # Verify user is in organisation
    user = await user_service.get(user.id)
    assert user is not None
    assert len(user.organisation_users) == 1
    assert user.organisation_users[0].organisation_id == org.id


@pytest.mark.asyncio
async def test_get_organisation_users(db_session: AsyncSession) -> None:
    """Test getting users in an organisation."""
    org_service = OrganisationService(db_session)
    user_service = UserService(db_session)
    
    # Create organisation
    org = await org_service.create(name="Test Org")
    
    # Create users
    user1 = await user_service.create(
        laimonid="user1",
        email="user1@example.com",
    )
    user2 = await user_service.create(
        laimonid="user2",
        email="user2@example.com",
    )
    
    # Add users to organisation
    await org_service.add_user_to_organisation(
        user_id=user1.id,
        organisation_id=org.id,
    )
    await org_service.add_user_to_organisation(
        user_id=user2.id,
        organisation_id=org.id,
    )
    
    # Get users in organisation
    users = await org_service.get_users(org.id)
    
    assert len(users) == 2
    user_ids = {u.id for u in users}
    assert user1.id in user_ids
    assert user2.id in user_ids


@pytest.mark.asyncio
async def test_get_user_organisations(db_session: AsyncSession) -> None:
    """Test getting organisations for a user."""
    org_service = OrganisationService(db_session)
    user_service = UserService(db_session)
    
    # Create organisations
    org1 = await org_service.create(name="Org 1")
    org2 = await org_service.create(name="Org 2")
    
    # Create user
    user = await user_service.create(
        laimonid="test_laimonid",
        email="test@example.com",
    )
    
    # Add user to organisations
    await org_service.add_user_to_organisation(
        user_id=user.id,
        organisation_id=org1.id,
    )
    await org_service.add_user_to_organisation(
        user_id=user.id,
        organisation_id=org2.id,
    )
    
    # Get user organisations
    orgs = await org_service.get_user_organisations(user.id)
    
    assert len(orgs) == 2
    org_ids = {o.id for o in orgs}
    assert org1.id in org_ids
    assert org2.id in org_ids


@pytest.mark.asyncio
async def test_hedgile_organisation_seeding(db_session: AsyncSession) -> None:
    """Test that Hedgile organisation can be created."""
    org_service = OrganisationService(db_session)
    
    # Create Hedgile organisation
    hedgile_org = await org_service.create(
        name="Hedgile",
        description="The Hedgile platform organisation",
    )
    
    assert hedgile_org is not None
    assert hedgile_org.name == "Hedgile"
    
    # Verify we can retrieve it by name
    retrieved = await org_service.get_by_name("Hedgile")
    assert retrieved is not None
    assert retrieved.id == hedgile_org.id


@pytest.mark.asyncio
async def test_user_isolation_between_organisations(db_session: AsyncSession) -> None:
    """Test that users in different organisations are isolated."""
    org_service = OrganisationService(db_session)
    user_service = UserService(db_session)
    
    # Create organisations
    org1 = await org_service.create(name="Org 1")
    org2 = await org_service.create(name="Org 2")
    
    # Create users
    user1 = await user_service.create(
        laimonid="user1",
        email="user1@example.com",
    )
    user2 = await user_service.create(
        laimonid="user2",
        email="user2@example.com",
    )
    
    # Add user1 to org1 only
    await org_service.add_user_to_organisation(
        user_id=user1.id,
        organisation_id=org1.id,
    )
    
    # Add user2 to org2 only
    await org_service.add_user_to_organisation(
        user_id=user2.id,
        organisation_id=org2.id,
    )
    
    # Get users in org1
    org1_users = await org_service.get_users(org1.id)
    assert len(org1_users) == 1
    assert org1_users[0].id == user1.id
    
    # Get users in org2
    org2_users = await org_service.get_users(org2.id)
    assert len(org2_users) == 1
    assert org2_users[0].id == user2.id
    
    # Verify user1 is not in org2
    user1_orgs = await org_service.get_user_organisations(user1.id)
    org1_ids = {o.id for o in user1_orgs}
    assert org1.id in org1_ids
    assert org2.id not in org1_ids
    
    # Verify user2 is not in org1
    user2_orgs = await org_service.get_user_organisations(user2.id)
    org2_ids = {o.id for o in user2_orgs}
    assert org2.id in org2_ids
    assert org1.id not in org2_ids
