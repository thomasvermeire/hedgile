"""Middleware for data isolation and authentication."""

from typing import Any, Callable

from fastapi import Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse

from hedgile.core.database import get_db
from hedgile.models.organisation import Organisation
from hedgile.models.user import User
from hedgile.services.auth import get_current_user


class DataIsolationMiddleware:
    """Middleware to ensure data isolation by organisation."""

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, request: Request, call_next: Callable[[Request], Any]) -> Any:
        """Check authentication and organisation membership."""
        # Skip for health check and auth endpoints
        if request.url.path in ["/health/", "/health", "/api/v1/auth/laimonid/callback", "/"]:
            return await call_next(request)

        # Check for authentication
        token = request.headers.get("Authorization")
        if not token or not token.startswith("Bearer "):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Not authenticated"},
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = token.split(" ")[1]

        # Get database session
        from hedgile.core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            # Get current user
            try:
                from hedgile.services.auth import AuthService
                from hedgile.services.organisation import OrganisationService
                from hedgile.services.user import UserService

                auth_service = AuthService(
                    user_service=UserService(db),
                    organisation_service=OrganisationService(db),
                )
                user = await auth_service.get_user_from_token(token)

                if not user:
                    return JSONResponse(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        content={"detail": "Invalid token"},
                        headers={"WWW-Authenticate": "Bearer"},
                    )

                # Check if user has at least one organisation
                if not user.organisation_users:
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "User not in any organisation"},
                    )

                # Store user in request state for downstream use
                request.state.user = user
                request.state.organisation_id = user.organisation_users[0].organisation_id

            except Exception as e:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": f"Authentication failed: {str(e)}"},
                    headers={"WWW-Authenticate": "Bearer"},
                )

        # Proceed with the request
        response = await call_next(request)
        return response


async def verify_organisation_access(
    user: User = Depends(get_current_user),
    organisation_id: str | None = None,
) -> User:
    """Verify that a user has access to a specific organisation."""
    # If no organisation_id is specified, use the user's first organisation
    if organisation_id:
        from uuid import UUID
        org_uuid = UUID(organisation_id)
        
        # Check if user belongs to this organisation
        has_access = any(
            ou.organisation_id == org_uuid for ou in user.organisation_users
        )
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have access to this organisation",
            )
    
    return user


async def require_organisation_admin(
    user: User = Depends(get_current_user),
    organisation_id: str | None = None,
) -> User:
    """Verify that a user is an admin in the specified organisation."""
    from uuid import UUID
    
    if organisation_id:
        org_uuid = UUID(organisation_id)
        # Check if user is admin in this organisation
        is_admin = any(
            ou.organisation_id == org_uuid and ou.role.value == "admin"
            for ou in user.organisation_users
        )
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
    else:
        # Check if user is admin in any organisation
        if not user.is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required",
            )
    
    return user
