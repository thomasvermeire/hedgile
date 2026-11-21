"""Organisation service for managing organisations and user memberships."""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hedgile.models.organisation import Organisation, OrganisationUser, UserRole
from hedgile.models.user import User


class OrganisationService:
    """Service for managing organisations."""

    def __init__(self, db: AsyncSession | Any) -> None:
        self.db = db

    async def get(self, organisation_id: UUID) -> Organisation | None:
        """Get an organisation by ID."""
        result = await self.db.execute(
            select(Organisation).where(Organisation.id == organisation_id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Organisation | None:
        """Get an organisation by name."""
        result = await self.db.execute(
            select(Organisation).where(Organisation.name == name)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        name: str,
        description: str | None = None,
        is_active: bool = True,
    ) -> Organisation:
        """Create a new organisation."""
        organisation = Organisation(
            name=name,
            description=description,
            is_active=is_active,
        )
        self.db.add(organisation)
        await self.db.commit()
        await self.db.refresh(organisation)
        return organisation

    async def list_organisations(self) -> list[Organisation]:
        """List all organisations."""
        result = await self.db.execute(select(Organisation))
        return result.scalars().all()

    async def get_users(self, organisation_id: UUID) -> list[User]:
        """Get all users in an organisation."""
        result = await self.db.execute(
            select(OrganisationUser)
            .where(OrganisationUser.organisation_id == organisation_id)
            .join(OrganisationUser.user)
        )
        organisation_users = result.scalars().all()
        return [ou.user for ou in organisation_users]

    async def add_user_to_organisation(
        self,
        user_id: UUID,
        organisation_id: UUID,
        role: UserRole = UserRole.USER,
    ) -> OrganisationUser:
        """Add a user to an organisation."""
        # Check if user already exists in organisation
        existing = await self.get_organisation_user(user_id, organisation_id)
        if existing:
            return existing

        organisation_user = OrganisationUser(
            user_id=user_id,
            organisation_id=organisation_id,
            role=role,
        )
        self.db.add(organisation_user)
        await self.db.commit()
        await self.db.refresh(organisation_user)
        return organisation_user

    async def ensure_user_in_organisation(
        self,
        user_id: UUID,
        organisation_id: UUID,
        role: UserRole = UserRole.USER,
    ) -> OrganisationUser:
        """Ensure a user is in an organisation, creating if not exists."""
        existing = await self.get_organisation_user(user_id, organisation_id)
        if existing:
            return existing

        return await self.add_user_to_organisation(user_id, organisation_id, role)

    async def get_organisation_user(
        self,
        user_id: UUID,
        organisation_id: UUID,
    ) -> OrganisationUser | None:
        """Get an organisation-user association."""
        result = await self.db.execute(
            select(OrganisationUser).where(
                OrganisationUser.user_id == user_id,
                OrganisationUser.organisation_id == organisation_id,
            )
        )
        return result.scalar_one_or_none()

    async def remove_user_from_organisation(
        self,
        user_id: UUID,
        organisation_id: UUID,
    ) -> bool:
        """Remove a user from an organisation."""
        organisation_user = await self.get_organisation_user(user_id, organisation_id)
        if not organisation_user:
            return False

        await self.db.delete(organisation_user)
        await self.db.commit()
        return True

    async def update_user_role(
        self,
        user_id: UUID,
        organisation_id: UUID,
        role: UserRole,
    ) -> OrganisationUser | None:
        """Update a user's role in an organisation."""
        organisation_user = await self.get_organisation_user(user_id, organisation_id)
        if not organisation_user:
            return None

        organisation_user.role = role
        await self.db.commit()
        await self.db.refresh(organisation_user)
        return organisation_user

    async def get_user_organisations(self, user_id: UUID) -> list[Organisation]:
        """Get all organisations a user belongs to."""
        result = await self.db.execute(
            select(OrganisationUser)
            .where(OrganisationUser.user_id == user_id)
            .join(OrganisationUser.organisation)
        )
        organisation_users = result.scalars().all()
        return [ou.organisation for ou in organisation_users]

    async def delete(self, organisation_id: UUID) -> bool:
        """Delete an organisation."""
        organisation = await self.get(organisation_id)
        if not organisation:
            return False

        await self.db.delete(organisation)
        await self.db.commit()
        return True
