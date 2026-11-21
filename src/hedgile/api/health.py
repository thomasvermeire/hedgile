"""Health check endpoint."""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from hedgile.core.config import settings

router = APIRouter()


@router.get("/")
async def health_check() -> JSONResponse:
    """Health check endpoint."""
    return JSONResponse(
        content={
            "status": "healthy",
            "app_name": settings.app_name,
        }
    )
