import uuid
from datetime import datetime

import bleach
from pydantic import BaseModel, ConfigDict, Field, field_validator


def _sanitize(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = bleach.clean(value, tags=[], attributes={}, strip=True).strip()
    return cleaned or None


class OrganiserRequestCreate(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, value: str | None) -> str | None:
        return _sanitize(value)


class OrganiserRequestResponse(BaseModel):
    request_id: uuid.UUID
    user_id: uuid.UUID
    reason: str | None
    status: str
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrganiserRequestAdminResponse(BaseModel):
    request_id: uuid.UUID
    user_id: uuid.UUID
    applicant_email: str
    applicant_display_name: str
    reason: str | None
    status: str
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
