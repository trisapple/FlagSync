import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DISPLAY_NAME_PATTERN = re.compile(r"^[A-Za-z0-9 ._'-]+$")


def _validate_email(value: str) -> str:
    normalized = value.strip().lower()
    if not EMAIL_PATTERN.fullmatch(normalized):
        raise ValueError("Enter a valid email address")
    return normalized


def _validate_display_name(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if len(normalized) < 2:
        raise ValueError("Display name must be at least 2 characters")
    if not DISPLAY_NAME_PATTERN.fullmatch(normalized):
        raise ValueError("Display name contains unsupported characters")
    return normalized


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)


class RegistrationChallengeResponse(BaseModel):
    challenge_id: str
    puzzle_type: str
    prompt: str
    hint: str
    expires_in_seconds: int


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=12, max_length=255)
    challenge_id: str = Field(min_length=16, max_length=128)
    challenge_answer: str = Field(min_length=1, max_length=120)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str) -> str:
        return _validate_display_name(value)


class UpdateProfileRequest(BaseModel):
    email: str | None = Field(default=None, min_length=3, max_length=255)
    display_name: str | None = Field(default=None, min_length=2, max_length=120)
    current_password: str | None = Field(default=None, min_length=8, max_length=255)
    new_password: str | None = Field(default=None, min_length=12, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_email(value)

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_display_name(value)

    @model_validator(mode="after")
    def validate_password_change(self) -> "UpdateProfileRequest":
        if self.new_password is not None and self.current_password is None:
            raise ValueError("Current password is required to change password")
        return self


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=32, max_length=255)


class ResendVerificationRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return _validate_email(value)


class AuthUserResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    display_name: str
    role_name: str | None = None
    account_status: str | None = None
    email_verified: bool = False
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    message: str
    user: AuthUserResponse | None = None


class LoginInitiateResponse(BaseModel):
    message: str
    login_intent_id: str


class LoginOtpRequest(BaseModel):
    login_intent_id: str = Field(min_length=16, max_length=128)
    otp: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")


class ResendLoginOtpRequest(BaseModel):
    login_intent_id: str = Field(min_length=16, max_length=128)


class MessageResponse(BaseModel):
    message: str
    verification_token: str | None = None
