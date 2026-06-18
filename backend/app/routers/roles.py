from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.role_repository import (
    get_all_roles,
    get_role_by_id,
)
from app.schemas.role import RoleResponse


router = APIRouter(
    prefix="/api/roles",
    tags=["Roles"],
)


@router.get(
    "",
    response_model=list[RoleResponse],
)
def list_roles(
    db: Session = Depends(get_db),
) -> list[RoleResponse]:
    try:
        return get_all_roles(db)

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve roles",
        )


@router.get(
    "/{role_id}",
    response_model=RoleResponse,
)
def retrieve_role(
    role_id: int,
    db: Session = Depends(get_db),
) -> RoleResponse:
    try:
        role = get_role_by_id(db, role_id)

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to retrieve role",
        )

    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    return role
