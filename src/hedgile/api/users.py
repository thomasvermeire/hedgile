"""User management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from hedgile.core.database import get_db
from hedgile.models.user import User
from hedgile.schemas.user import UserRead
from hedgile.services.auth import get_current_user, get_current_organisation
from hedgile.services.organisation import OrganisationService
from hedgile.services.user import UserService

router = APIRouter()


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get current user",
    description="Get information about the currently authenticated user",
)
async def get_me(
    db: any = Depends(get_db),
) -> UserRead:
    """Get current user information."""
    current_user = await get_current_user(db)
    
    # Get user organisations
    org_service = OrganisationService(db)
    organisations = await org_service.get_user_organisations(current_user.id)

    return UserRead(
        id=current_user.id,
        laimonid=current_user.laimonid,
        email=current_user.email,
        name=current_user.name,
        avatar=current_user.avatar,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        organisations=[org.id for org in organisations],
    )


@router.get(
    "/",
    response_model=list[UserRead],
    summary="List users",
    description="List all users in the current organisation",
)
async def list_users(
    organisation: any = Depends(get_current_organisation),
    db: any = Depends(get_db),
) -> list[UserRead]:
    """List all users in the current organisation."""
    org_service = OrganisationService(db)
    users = await org_service.get_users(organisation.id)

    return [
        UserRead(
            id=user.id,
            laimonid=user.laimonid,
            email=user.email,
            name=user.name,
            avatar=user.avatar,
            created_at=user.created_at,
            updated_at=user.updated_at,
            organisations=[ou.organisation_id for ou in user.organisation_users],
        )
        for user in users
    ]
