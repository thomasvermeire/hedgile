"""Hedgile FastAPI application."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from hedgile.api import router as api_router
from hedgile.core.config import settings
from hedgile.core.database import init_db
from hedgile.core.middleware import DataIsolationMiddleware
from hedgile.services.organisation import OrganisationService
from hedgile.services.user import UserService


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    # Startup
    await init_db()
    
    # Seed Hedgile organisation if it doesn't exist
    from hedgile.core.database import engine
    from sqlalchemy.ext.asyncio import AsyncSession
    from sqlalchemy.orm import sessionmaker
    
    async_session = sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with async_session() as db:
        org_service = OrganisationService(db)
        hedgile_org = await org_service.get_by_name("Hedgile")
        if not hedgile_org:
            await org_service.create(
                name="Hedgile",
                description="The Hedgile platform organisation",
            )
    
    yield
    
    # Shutdown
    pass


app = FastAPI(
    title=settings.app_name,
    description="Hedgile helps small trading teams manage nickel trades from contract to final invoice",
    version="0.1.0",
    lifespan=lifespan,
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root() -> JSONResponse:
    """Root endpoint."""
    return JSONResponse(
        content={
            "message": "Welcome to Hedgile",
            "docs": "/docs",
        }
    )


# Global exception handler for unauthenticated requests
@app.exception_handler(Exception)
async def global_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Global exception handler."""
    if isinstance(exc, Exception):
        # Check if it's an authentication error
        if "Not authenticated" in str(exc) or "Invalid token" in str(exc):
            return JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated"},
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    # Re-raise for other exceptions
    raise exc
