import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ResourceResponse(BaseModel):
    resource_id: uuid.UUID
    event_id: uuid.UUID
    challenge_id: uuid.UUID | None = None
    uploaded_by: uuid.UUID
    file_name: str
    mime_type: str | None
    file_size: int | None
    uploaded_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ResourceDownloadResponse(BaseModel):
    signed_url: str
    expires_in_seconds: int
