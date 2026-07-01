import uuid
from datetime import datetime

import bleach
from pydantic import BaseModel, ConfigDict, Field, field_validator


def _strip_html(value: str) -> str:
    return bleach.clean(value, tags=[], attributes={}, strip=True).strip()


class ChallengeCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    flag: str = Field(min_length=1, max_length=500)
    points: int = Field(gt=0, le=10000)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        return " ".join(_strip_html(value).split())

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = _strip_html(value)
        return cleaned or None


class ChallengeResponse(BaseModel):
    challenge_id: uuid.UUID
    event_id: uuid.UUID | None
    title: str
    description: str | None
    points: int
    is_active: bool
    created_at: datetime
    solved_by_me: bool = False

    model_config = ConfigDict(from_attributes=True)


class FlagSubmissionRequest(BaseModel):
    submitted_flag: str = Field(min_length=1, max_length=500)


class FlagSubmissionResponse(BaseModel):
    is_correct: bool
    score_awarded: int
    message: str
