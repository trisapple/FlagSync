from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)


class AuthUserResponse(BaseModel):
    user_id: int
    email: str
    display_name: str
    role_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    message: str
    user: AuthUserResponse | None = None
