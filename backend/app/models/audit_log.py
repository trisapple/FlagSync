from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id"),
        nullable=True,
        index=True,
    )

    action_type: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        index=True,
    )

    resource_type: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )

    resource_id: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    result: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    details: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
        index=True,
    )

    actor: Mapped[User | None] = relationship()
