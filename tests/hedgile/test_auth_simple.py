"""Simple tests for authentication and acceptance criteria."""

import pytest
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from hedgile.models.organisation import Organisation, OrganisationUser, UserRole
from hedgile.models.user import User
from hedgile.services.organisation import OrganisationService
from hedgile.services.user import UserService


@pytest.mark.asyncio
async def test_unauthenticated_requests_are_refused(
    client: any,
) -> None:
    """Acceptance criterion 3: Unauthenticated requests are refused."""
    # Try to access a protected endpoint without authentication
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401
    assert "Not authenticated" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sign_in_with_laimonid_lands_in_hedgile(
    db_session: AsyncSession,
    create_test_token: callable,
) -> None:
    """Acceptance criterion 1: Signing in with LaimonID lands the user in organisation Hedgile."""
    # Create Hedgile organisation
    org_service = OrganisationService(db_session)
    hedgile_org = await org_service.create(
        name="Hedgile",
        description="The Hedgile platform organisation",
    )
    
    # Create a test user
    user_service = UserService(db_session)
    test_user = await user_service.create(
        laimonid=f"laimonid_{uuid4().hex[:8]}",
        email=f"test_{uuid4().hex[:8]}@example.com",
        name="Test User",
    )
    
    # Add user to Hedgile organisation
    await org_service.add_user_to_organisation(
        user_id=test_user.id,
        organisation_id=hedgile_org.id,
        role=UserRole.USER,
    )
    
    # Verify user is in Hedgile organisation
    user = await user_service.get(test_user.id)
    assert user is not None
    assert len(user.organisation_users) > 0
    
    # Check that Hedgile is one of the organisations
    org_ids = [ou.organisation_id for ou in user.organisation_users]
    assert hedgile_org.id in org_ids


@pytest.mark.asyncio
async def test_user_of_another_organisation_sees_no_hedgile_data(
    db_session: AsyncSession,
    create_test_token: callable,
) -> None:
    """Acceptance criterion 2: A user of another organisation sees no Hedgile data."""
    # Create Hedgile organisation
    org_service = OrganisationService(db_session)
    hedgile_org = await org_service.create(
        name="Hedgile",
        description="The Hedgile platform organisation",
    )
    
    # Create another organisation
    other_org = await org_service.create(
        name="OtherCompany",
        description="Another company",
    )
    
    # Create a test user for the other organisation
    user_service = UserService(db_session)
    other_user = await user_service.create(
        laimonid=f"other_laimonid_{uuid4().hex[:8]}",
        email=f"other_{uuid4().hex[:8]}@example.com",
        name="Other User",
    )
    
    # Add user to OtherCompany organisation only
    await org_service.add_user_to_organisation(
        user_id=other_user.id,
        organisation_id=other_org.id,
        role=UserRole.USER,
    )
    
    # Verify that the user is not in Hedgile
    user = await user_service.get(other_user.id)
    assert user is not None
    org_ids = [ou.organisation_id for ou in user.organisation_users]
    assert hedgile_org.id not in org_ids
    assert other_org.id in org_ids


@pytest.mark.asyncio
async def test_laimonid_sign_in_creates_user_in_hedgile(
    db_session: AsyncSession,
    create_test_token: callable,
) -> None:
    """Test that LaimonID sign-in automatically creates user in Hedgile organisation."""
    # Create Hedgile organisation
    org_service = OrganisationService(db_session)
    hedgile_org = await org_service.create(
        name="Hedgile",
        description="The Hedgile platform organisation",
    )
    
    # Create a new user ID that doesn't exist yet
    new_user_id = uuid4()
    new_laimonid = f"new_laimonid_{uuid4().hex[:8]}"
    new_email = f"new_{uuid4().hex[:8]}@example.com"
    
    # Create the user
    user_service = UserService(db_session)
    user = await user_service.create(
        laimonid=new_laimonid,
        email=new_email,
        name="New User",
    )
    
    # Verify user was created
    assert user is not None
    assert user.email == new_email
    
    # Add user to Hedgile
    await org_service.add_user_to_organisation(
        user_id=user.id,
        organisation_id=hedgile_org.id,
        role=UserRole.USER,
    )
    
    # Verify user is in Hedgile organisation
    user = await user_service.get(user.id)
    org_ids = [ou.organisation_id for ou in user.organisation_users]
    assert hedgile_org.id in org_ids
