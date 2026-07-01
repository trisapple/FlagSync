import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


TEAM_NAME_PATTERN = re.compile(r"^[A-Za-z0-9 ._'\-]+$")


def _clean_team_name(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if len(normalized) < 2:
        raise ValueError("Team name must be at least 2 characters")
    if not TEAM_NAME_PATTERN.fullmatch(normalized):
        raise ValueError("Team name contains unsupported characters")
    return normalized


class TeamCreateRequest(BaseModel):
    team_name: str = Field(min_length=2, max_length=255)

    @field_validator("team_name")
    @classmethod
    def validate_team_name(cls, value: str) -> str:
        return _clean_team_name(value)


class TeamJoinRequest(BaseModel):
    invite_code: str = Field(min_length=4, max_length=32)

    @field_validator("invite_code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().lower()


class TeamMemberResponse(BaseModel):
    user_id: uuid.UUID
    display_name: str
    email: str
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TeamResponse(BaseModel):
    team_id: uuid.UUID
    event_id: uuid.UUID
    team_name: str
    leader_id: uuid.UUID
    invite_code: str
    created_at: datetime
    members: list[TeamMemberResponse] = []

    model_config = ConfigDict(from_attributes=True)
