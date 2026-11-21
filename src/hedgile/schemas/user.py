"""User schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    """Base user schema."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    laimonid: str
    email: EmailStr
    name: str | None = None
    avatar: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class UserCreate(BaseModel):
    """Schema for creating a user."""

    laimonid: str
    email: EmailStr
    name: str | None = None
    avatar: str | None = None


class UserRead(UserBase):
    """User schema with organisations."""

    organisations: list[UUID] = []
