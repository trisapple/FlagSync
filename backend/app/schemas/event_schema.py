import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


EventType = Literal["ctf", "hackathon"]
EventFormat = Literal["online", "hybrid", "in_person"]
EventStatus = Literal["draft", "published", "closed", "cancelled"]


def _clean_text(value: str) -> str:
    return " ".join(value.strip().split())


def _clean_description(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


class EventCreateRequest(BaseModel):
    event_name: str = Field(min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    event_type: EventType
    event_format: EventFormat
    location: str = Field(min_length=1, max_length=255)
    start_date: datetime
    end_date: datetime
    registration_deadline: datetime
    capacity: int | None = Field(default=None, gt=0)
    team_mode: bool = True
    max_team_size: int = Field(default=1, gt=0)
    leaderboard_visible: bool = True
    status: EventStatus = "draft"

    @field_validator("event_name", "location")
    @classmethod
    def clean_text_fields(cls, value: str) -> str:
        return _clean_text(value)

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        return _clean_description(value)

    @model_validator(mode="after")
    def validate_dates(self) -> "EventCreateRequest":
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        if self.registration_deadline > self.start_date:
            raise ValueError(
                "registration_deadline must be on or before start_date",
            )
        return self


class EventUpdateRequest(BaseModel):
    event_name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=5000)
    event_type: EventType | None = None
    event_format: EventFormat | None = None
    location: str | None = Field(default=None, min_length=1, max_length=255)
    start_date: datetime | None = None
    end_date: datetime | None = None
    registration_deadline: datetime | None = None
    capacity: int | None = Field(default=None, gt=0)
    team_mode: bool | None = None
    max_team_size: int | None = Field(default=None, gt=0)
    leaderboard_visible: bool | None = None
    status: EventStatus | None = None

    @field_validator("event_name", "location")
    @classmethod
    def clean_text_fields(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _clean_text(value)

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        return _clean_description(value)


class EventResponse(BaseModel):
    event_id: uuid.UUID
    organiser_id: uuid.UUID
    organiser_name: str | None = None
    event_name: str
    description: str | None
    event_type: str
    event_format: str
    location: str
    start_date: datetime
    end_date: datetime
    registration_deadline: datetime | None
    capacity: int | None
    team_mode: bool
    max_team_size: int
    leaderboard_visible: bool
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
