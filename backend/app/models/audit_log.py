from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_log_id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.user_id"),
        nullable=True,
        index=True,
    )

    action: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        index=True,
    )

    resource_type: Mapped[str | None] = mapped_column(
        String(80),
        nullable=True,
    )

    resource_id: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    details_json: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
        index=True,
    )

    actor: Mapped[User | None] = relationship()
