import os
import re
import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories.event_repository import get_event_by_id
from app.repositories.resource_repository import (
    create_resource,
    delete_resource,
    get_resource_by_id,
    list_resources_for_event,
    sum_user_storage_bytes,
)
from app.schemas.resource_schema import (
    ResourceDownloadResponse,
    ResourceResponse,
)
from app.services.auth_service import (
    assert_owns_resource,
    get_current_user_from_request,
    record_audit_event,
    require_organiser,
)
from app.services.storage_service import (
    SIGNED_URL_TTL_SECONDS,
    build_object_path,
    create_signed_download_url,
    delete_file,
    detect_mime_type,
    is_configured,
    upload_file,
)


MAX_FILE_BYTES = int(os.getenv("RESOURCE_MAX_FILE_BYTES", str(50 * 1024 * 1024)))
USER_QUOTA_BYTES = int(
    os.getenv("RESOURCE_USER_QUOTA_BYTES", str(500 * 1024 * 1024)),
)

_SAFE_FILENAME_PATTERN = re.compile(r"[^A-Za-z0-9._\- ]")


def _sanitize_filename(name: str) -> str:
    cleaned = _SAFE_FILENAME_PATTERN.sub("", name or "")
    cleaned = cleaned.strip()
    return cleaned[:200] or "resource"


event_resource_router = APIRouter(
    prefix="/api/events/{event_id}/resources",
    tags=["Resources"],
)


resource_router = APIRouter(
    prefix="/api/resources",
    tags=["Resources"],
)


@event_resource_router.get("", response_model=list[ResourceResponse])
def list_event_resources(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> list[ResourceResponse]:
    get_current_user_from_request(request, db)

    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    return list_resources_for_event(db, event_id)


@event_resource_router.post(
    "",
    response_model=ResourceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_event_resource(
    event_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    challenge_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
) -> ResourceResponse:
    user = require_organiser(request, db)

    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resource storage is not configured",
        )

    event = get_event_by_id(db, event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    assert_owns_resource(user, event.organiser_id)

    content = await file.read()
    file_size = len(content)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    if file_size > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(f"File exceeds the {MAX_FILE_BYTES // (1024 * 1024)} MB limit."),
        )

    current_usage = sum_user_storage_bytes(db, user.user_id)
    if current_usage + file_size > USER_QUOTA_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Upload would exceed your "
                f"{USER_QUOTA_BYTES // (1024 * 1024)} MB storage quota."
            ),
        )

    detected_mime = detect_mime_type(content)
    if detected_mime is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File type is not allowed",
        )

    safe_name = _sanitize_filename(file.filename or "resource")
    object_path = build_object_path(event_id, safe_name)

    upload_ok = upload_file(
        object_path=object_path,
        content=content,
        mime_type=detected_mime,
    )
    if not upload_ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to store file",
        )

    try:
        resource = create_resource(
            db,
            event_id=event_id,
            challenge_id=challenge_id,
            uploaded_by=user.user_id,
            file_name=safe_name,
            storage_path=object_path,
            mime_type=detected_mime,
            file_size=file_size,
        )
        record_audit_event(
            db,
            action_type="resource_uploaded",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="resource",
            resource_id=str(resource.resource_id),
            details={
                "event_id": str(event_id),
                "challenge_id": str(challenge_id) if challenge_id else None,
                "file_size": file_size,
                "mime_type": detected_mime,
            },
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        delete_file(object_path)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to record resource",
        )

    return resource


@resource_router.get(
    "/{resource_id}/download",
    response_model=ResourceDownloadResponse,
)
def get_resource_signed_url(
    resource_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
) -> ResourceDownloadResponse:
    user = get_current_user_from_request(request, db)

    resource = get_resource_by_id(db, resource_id)
    if resource is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found",
        )

    signed_url = create_signed_download_url(resource.storage_path)
    if signed_url is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to generate download link",
        )

    try:
        record_audit_event(
            db,
            action_type="resource_download_url_issued",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="resource",
            resource_id=str(resource_id),
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()

    return ResourceDownloadResponse(
        signed_url=signed_url,
        expires_in_seconds=SIGNED_URL_TTL_SECONDS,
    )


@resource_router.delete(
    "/{resource_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_existing_resource(
    resource_id: uuid.UUID,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> Response:
    user = require_organiser(request, db)

    resource = get_resource_by_id(db, resource_id)
    if resource is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found",
        )

    assert_owns_resource(user, resource.uploaded_by)

    storage_path = resource.storage_path

    try:
        delete_resource(db, resource)
        record_audit_event(
            db,
            action_type="resource_deleted",
            result="success",
            request=request,
            actor_user_id=user.user_id,
            resource_type="resource",
            resource_id=str(resource_id),
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to delete resource",
        )

    delete_file(storage_path)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
