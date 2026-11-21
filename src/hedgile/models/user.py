"""User model for authentication."""

from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hedgile.models.base import Base

if TYPE_CHECKING:
    from hedgile.models.organisation import OrganisationUser


class User(Base):
    """User model representing an authenticated user from LaimonID."""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    laimonid: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Relationships
    organisation_users: Mapped[list["OrganisationUser"]] = relationship(
        "OrganisationUser",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    @property
    def organisations(self: Any) -> list[Any]:
        """Get list of organisations the user belongs to."""
        return [ou.organisation for ou in self.organisation_users]

    @property
    def is_admin(self: Any, organisation_id: UUID | None = None) -> bool:
        """Check if user is admin in any organisation or a specific one."""
        if organisation_id:
            for ou in self.organisation_users:
                if ou.organisation_id == organisation_id:
                    return ou.role == "admin"
            return False
        return any(ou.role == "admin" for ou in self.organisation_users)

    @property
    def current_organisation(self: Any) -> Any | None:
        """Get the user's current organisation (first one for now)."""
        if self.organisation_users:
            return self.organisation_users[0].organisation
        return None
