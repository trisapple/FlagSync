from pydantic import BaseModel, ConfigDict


class RoleResponse(BaseModel):
    role_id: int
    role_name: str

    model_config = ConfigDict(from_attributes=True)
