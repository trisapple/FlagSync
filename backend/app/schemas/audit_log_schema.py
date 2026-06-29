import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    log_id: uuid.UUID
    actor_user_id: uuid.UUID | None
    action_type: str
    resource_type: str | None
    resource_id: str | None
    result: str
    details: dict[str, Any] | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
