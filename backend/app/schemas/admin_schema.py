from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    display_name: str
    email: str
    role_name: str | None = None
    is_active: bool
    created_at: datetime

    @classmethod
    def from_user(cls, user) -> "AdminUserResponse":
        return cls(
            user_id=user.user_id,
            display_name=user.display_name,
            email=user.email,
            role_name=user.role.role_name if user.role is not None else None,
            is_active=user.is_active,
            created_at=user.created_at,
        )


class AdminUsersListResponse(BaseModel):
    items: list[AdminUserResponse]
    total: int
    active_administrator_count: int


AllowedRoleName = Literal["user", "organiser", "administrator"]


class UpdateUserStatusRequest(BaseModel):
    is_active: bool
    reason: str = Field(
        min_length=5,
        max_length=500,
        description="Reason recorded in the audit log.",
    )


class UpdateUserRoleRequest(BaseModel):
    role_name: AllowedRoleName
    reason: str = Field(
        min_length=5,
        max_length=500,
        description="Reason recorded in the audit log.",
    )


class AdminUserActionResponse(BaseModel):
    user: AdminUserResponse
    message: str
