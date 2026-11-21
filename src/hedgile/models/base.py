"""Base model for all database models."""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )

    def to_dict(self: Any) -> dict[str, Any]:
        """Convert model instance to dictionary."""
        return {
            c.name: getattr(self, c.name)
            for c in self.__table__.columns
            if c.name != "_sa_instance_state"
        }
