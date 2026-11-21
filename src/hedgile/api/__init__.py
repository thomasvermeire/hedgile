"""API routers for Hedgile."""

from fastapi import APIRouter

from hedgile.api.auth import router as auth_router
from hedgile.api.health import router as health_router
from hedgile.api.organisations import router as organisations_router
from hedgile.api.users import router as users_router

# Create main router
router = APIRouter()

# Include sub-routers
router.include_router(health_router, prefix="/health", tags=["health"])
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(users_router, prefix="/users", tags=["users"])
router.include_router(
    organisations_router, prefix="/organisations", tags=["organisations"]
)
