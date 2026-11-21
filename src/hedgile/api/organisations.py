"""Organisation management endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from hedgile.core.database import get_db
from hedgile.models.organisation import Organisation
from hedgile.schemas.organisation import OrganisationRead
from hedgile.services.auth import get_current_user, get_current_organisation
from hedgile.services.organisation import OrganisationService

router = APIRouter()


@router.get(
    "/current",
    response_model=OrganisationRead,
    summary="Get current organisation",
    description="Get information about the current organisation",
)
async def get_current_organisation_info(
    organisation: Organisation = Depends(get_current_organisation),
    db: any = Depends(get_db),
) -> OrganisationRead:
    """Get current organisation information."""
    org_service = OrganisationService(db)
    users = await org_service.get_users(organisation.id)

    return OrganisationRead(
        id=organisation.id,
        name=organisation.name,
        description=organisation.description,
        is_active=organisation.is_active,
        created_at=organisation.created_at,
        updated_at=organisation.updated_at,
        user_count=len(users),
    )


@router.get(
    "/",
    response_model=list[OrganisationRead],
    summary="List organisations",
    description="List all organisations the current user belongs to",
)
async def list_user_organisations(
    current_user: any = Depends(get_current_user),
    db: any = Depends(get_db),
) -> list[OrganisationRead]:
    """List all organisations the current user belongs to."""
    org_service = OrganisationService(db)
    organisations = await org_service.get_user_organisations(current_user.id)

    result = []
    for org in organisations:
        users = await org_service.get_users(org.id)
        result.append(
            OrganisationRead(
                id=org.id,
                name=org.name,
                description=org.description,
                is_active=org.is_active,
                created_at=org.created_at,
                updated_at=org.updated_at,
                user_count=len(users),
            )
        )

    return result
