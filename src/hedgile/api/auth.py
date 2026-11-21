"""Authentication endpoints for LaimonID sign-in."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from hedgile.core.database import get_db
from hedgile.schemas.user import UserRead
from hedgile.services.auth import AuthService, Token, get_current_user
from hedgile.services.organisation import OrganisationService
from hedgile.services.user import UserService

router = APIRouter()


@router.post(
    "/laimonid/callback",
    response_model=Token,
    summary="LaimonID OAuth2 callback",
    description="Exchange LaimonID token for Hedgile access token",
)
async def laimonid_callback(
    request: Request,
    db: any = Depends(get_db),
) -> Token:
    """Handle LaimonID OAuth2 callback and issue Hedgile token."""
    # Get the token from the request
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = token.split(" ")[1]

    # Authenticate with LaimonID
    auth_service = AuthService(
        user_service=UserService(db),
        organisation_service=OrganisationService(db),
    )

    user, access_token = await auth_service.authenticate_with_laimonid(token)

    return Token(
        access_token=access_token,
        token_type="bearer",
    )


@router.get(
    "/me",
    response_model=UserRead,
    summary="Get current user",
    description="Get information about the currently authenticated user",
)
async def get_current_user_info(
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
