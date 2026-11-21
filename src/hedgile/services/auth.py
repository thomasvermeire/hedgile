"""Authentication service using LaimonID OAuth2."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2AuthorizationCodeBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from hedgile.core.config import settings
from hedgile.core.database import get_db
from hedgile.models.organisation import Organisation, UserRole
from hedgile.models.user import User
from hedgile.services.organisation import OrganisationService
from hedgile.services.user import UserService

# OAuth2 scheme for LaimonID
oauth2_scheme = OAuth2AuthorizationCodeBearer(
    authorizationUrl=settings.laimonid_authorize_url,
    tokenUrl=settings.laimonid_token_url,
)


class Token(BaseModel):
    """OAuth2 token response."""

    access_token: str
    token_type: str


class TokenData(BaseModel):
    """JWT token data."""

    laimonid: str | None = None
    organisation_id: UUID | None = None
    email: str | None = None


class LaimonIDUser(BaseModel):
    """LaimonID user info."""

    sub: str  # LaimonID user ID
    email: str
    name: str | None = None
    picture: str | None = None


class AuthService:
    """Service for handling LaimonID authentication."""

    def __init__(
        self,
        user_service: UserService,
        organisation_service: OrganisationService,
    ) -> None:
        self.user_service = user_service
        self.organisation_service = organisation_service

    def _create_access_token(
        self,
        data: dict[str, Any],
        expires_delta: timedelta | None = None,
    ) -> str:
        """Create a JWT access token."""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(
                minutes=settings.access_token_expire_minutes
            )

        to_encode.update(
            {
                "exp": expire,
                "iat": datetime.now(timezone.utc),
            }
        )
        encoded_jwt = jwt.encode(
            to_encode,
            settings.secret_key,
            algorithm=settings.algorithm,
        )
        return encoded_jwt

    async def verify_laimonid_token(
        self,
        token: str,
    ) -> LaimonIDUser | None:
        """Verify LaimonID token and get user info."""
        # In production, this would make an HTTP request to LaimonID
        # For now, we'll simulate it
        try:
            # Decode the token to get user info
            # This is a placeholder - in production, we'd call the userinfo endpoint
            payload = jwt.decode(
                token,
                settings.secret_key,
                algorithms=[settings.algorithm],
                options={"verify_signature": False},  # For dev only
            )
            return LaimonIDUser(
                sub=str(payload.get("sub", "")),
                email=str(payload.get("email", "")),
                name=str(payload.get("name", "")) if payload.get("name") else None,
                picture=str(payload.get("picture", "")) if payload.get("picture") else None,
            )
        except JWTError:
            return None

    async def authenticate_with_laimonid(
        self,
        token: str,
    ) -> tuple[User, str]:
        """Authenticate user with LaimonID token."""
        laimonid_user = await self.verify_laimonid_token(token)
        if not laimonid_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid LaimonID token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get or create user
        user = await self.user_service.get_or_create_user(
            laimonid=laimonid_user.sub,
            email=laimonid_user.email,
            name=laimonid_user.name,
            avatar=laimonid_user.picture,
        )

        # Get Hedgile organisation
        hedgile_org = await self.organisation_service.get_by_name("Hedgile")
        if not hedgile_org:
            hedgile_org = await self.organisation_service.create(
                name="Hedgile",
                description="The Hedgile platform organisation",
            )

        # Ensure user is in Hedgile organisation
        await self.organisation_service.ensure_user_in_organisation(
            user_id=user.id,
            organisation_id=hedgile_org.id,
            role=UserRole.USER,
        )

        # Create access token
        access_token = self._create_access_token(
            data={
                "sub": str(user.id),
                "laimonid": user.laimonid,
                "email": user.email,
                "organisation_id": str(hedgile_org.id),
            },
            expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        )

        return user, access_token

    async def get_user_from_token(
        self,
        token: str,
    ) -> User | None:
        """Get user from JWT token."""
        try:
            payload = jwt.decode(
                token,
                settings.secret_key,
                algorithms=[settings.algorithm],
            )
            laimonid: str = payload.get("sub", "")
            if not laimonid:
                return None

            user = await self.user_service.get_by_laimonid(laimonid)
            return user
        except JWTError:
            return None


# Dependency to get current user
async def get_current_user(
    request: Request,
    db: Any = Depends(get_db),
) -> User:
    """Get the current authenticated user from the request."""
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = token.split(" ")[1]
    auth_service = AuthService(
        user_service=UserService(db),
        organisation_service=OrganisationService(db),
    )

    user = await auth_service.get_user_from_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


# Dependency to get current organisation
async def get_current_organisation(
    user: User = Depends(get_current_user),
    db: Any = Depends(get_db),
) -> Organisation:
    """Get the current organisation for the user."""
    if not user.organisation_users:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User not in any organisation",
        )

    # For now, use the first organisation
    organisation_user = user.organisation_users[0]
    organisation_service = OrganisationService(db)
    organisation = await organisation_service.get(organisation_user.organisation_id)
    
    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organisation not found",
        )

    return organisation
