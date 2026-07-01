import uuid
from datetime import datetime

import bleach
from pydantic import BaseModel, ConfigDict, Field, field_validator


def _strip_all_html(value: str) -> str:
    return bleach.clean(value, tags=[], attributes={}, strip=True)


def _clean_text(value: str) -> str:
    stripped = _strip_all_html(value)
    return " ".join(stripped.strip().split())


def _clean_content(value: str) -> str:
    stripped = _strip_all_html(value)
    return stripped.strip()


class AnnouncementCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    content: str = Field(min_length=1, max_length=10000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        return _clean_text(value)

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str) -> str:
        return _clean_content(value)


class AnnouncementResponse(BaseModel):
    announcement_id: uuid.UUID
    event_id: uuid.UUID
    created_by: uuid.UUID
    title: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
