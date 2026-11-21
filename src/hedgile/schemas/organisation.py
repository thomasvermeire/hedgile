"""Organisation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from hedgile.models.organisation import UserRole


class OrganisationBase(BaseModel):
    """Base organisation schema."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime | None = None


class OrganisationCreate(BaseModel):
    """Schema for creating an organisation."""

    name: str
    description: str | None = None
    is_active: bool = True


class OrganisationRead(OrganisationBase):
    """Organisation schema with user count."""

    user_count: int = 0


class OrganisationUserBase(BaseModel):
    """Base organisation-user schema."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    organisation_id: UUID
    role: UserRole
    created_at: datetime
    updated_at: datetime | None = None


class OrganisationUserCreate(BaseModel):
    """Schema for creating an organisation-user association."""

    user_id: UUID
    organisation_id: UUID
    role: UserRole = UserRole.USER


class OrganisationUserRead(OrganisationUserBase):
    """Organisation-user schema with user and organisation details."""

    user_name: str | None = None
    user_email: str | None = None
    organisation_name: str | None = None
