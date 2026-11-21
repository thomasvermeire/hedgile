"""User service for managing users."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hedgile.models.user import User


class UserService:
    """Service for managing users."""

    def __init__(self, db: AsyncSession | Any) -> None:
        self.db = db

    async def get(self, user_id: UUID) -> User | None:
        """Get a user by ID."""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_laimonid(self, laimonid: str) -> User | None:
        """Get a user by LaimonID."""
        result = await self.db.execute(
            select(User).where(User.laimonid == laimonid)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        """Get a user by email."""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        laimonid: str,
        email: str,
        name: str | None = None,
        avatar: str | None = None,
    ) -> User:
        """Create a new user."""
        user = User(
            laimonid=laimonid,
            email=email,
            name=name,
            avatar=avatar,
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_or_create_user(
        self,
        laimonid: str,
        email: str,
        name: str | None = None,
        avatar: str | None = None,
    ) -> User:
        """Get or create a user."""
        user = await self.get_by_laimonid(laimonid)
        if user:
            return user

        return await self.create(
            laimonid=laimonid,
            email=email,
            name=name,
            avatar=avatar,
        )

    async def list_users(self) -> list[User]:
        """List all users."""
        result = await self.db.execute(select(User))
        return result.scalars().all()

    async def delete(self, user_id: UUID) -> bool:
        """Delete a user."""
        user = await self.get(user_id)
        if not user:
            return False

        await self.db.delete(user)
        await self.db.commit()
        return True
