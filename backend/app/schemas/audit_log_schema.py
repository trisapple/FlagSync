from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    audit_log_id: int
    actor_user_id: int | None
    action: str
    resource_type: str | None
    resource_id: str | None
    ip_address: str | None
    details_json: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogsListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
