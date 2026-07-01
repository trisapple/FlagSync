import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.event_schema import EventResponse


class EventRegistrationResponse(BaseModel):
    registration_id: uuid.UUID
    event_id: uuid.UUID
    user_id: uuid.UUID
    registration_status: str
    registered_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RegisteredEventResponse(BaseModel):
    registration_id: uuid.UUID
    registration_status: str
    registered_at: datetime
    event: EventResponse

    model_config = ConfigDict(from_attributes=True)


class ParticipantResponse(BaseModel):
    registration_id: uuid.UUID
    user_id: uuid.UUID
    display_name: str
    email: str
    registration_status: str
    registered_at: datetime

    model_config = ConfigDict(from_attributes=True)
