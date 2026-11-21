"""Organisation models for multi-tenancy."""

from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, String, Uuid, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from hedgile.models.base import Base

if TYPE_CHECKING:
    from hedgile.models.user import User


class UserRole(str, Enum):
    """User roles within an organisation."""

    ADMIN = "admin"
    USER = "user"


class Organisation(Base):
    """Organisation model representing a tenant."""

    __tablename__ = "organisations"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(512), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    organisation_users: Mapped[list["OrganisationUser"]] = relationship(
        "OrganisationUser",
        back_populates="organisation",
        cascade="all, delete-orphan",
    )

    @property
    def users(self: Any) -> list["User"]:
        """Get list of users in this organisation."""
        return [ou.user for ou in self.organisation_users]


class OrganisationUser(Base):
    """Association table for many-to-many relationship between User and Organisation."""

    __tablename__ = "organisation_users"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    organisation_id: Mapped[UUID] = mapped_column(Uuid, ForeignKey("organisations.id"), nullable=False, index=True)
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole), default=UserRole.USER, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="organisation_users")
    organisation: Mapped[Organisation] = relationship(
        "Organisation", back_populates="organisation_users"
    )
