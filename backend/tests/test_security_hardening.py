import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException, Request, status

from app.database import SessionLocal
from app.models.resource import Resource
from app.repositories.audit_log_repository import create_audit_log
from app.repositories.resource_repository import count_user_resources
from app.repositories.role_repository import get_role_by_name
from app.repositories.user_repository import create_user
from app.routers import auth_router, challenges
from app.services import auth_service
from app.services.auth_service import get_password_hash

from conftest import register_account
from test_admin import login_as_admin
from test_auth_security import complete_login


def test_password_reset_flow_changes_password(client, monkeypatch):
    register_account(
        client,
        email="resetme@flagsync.test",
        password="OldValidPass123!",
    )
    captured = {}

    def capture_reset_token(user_id):
        token = auth_service.create_password_reset_token(user_id)
        captured["token"] = token
        return token

    monkeypatch.setattr(auth_router, "create_password_reset_token", capture_reset_token)

    request_response = client.post(
        "/api/auth/password-reset/request",
        json={"email": "resetme@flagsync.test"},
    )
    assert request_response.status_code == 200
    assert request_response.json()["reset_token"] is None

    confirm_response = client.post(
        "/api/auth/password-reset/confirm",
        json={
            "token": captured["token"],
            "new_password": "NewValidPass123!",
        },
    )
    assert confirm_response.status_code == 200

    old_login = client.post(
        "/api/auth/login",
        json={"email": "resetme@flagsync.test", "password": "OldValidPass123!"},
    )
    assert old_login.status_code == 401

    new_login = complete_login(
        client,
        monkeypatch,
        email="resetme@flagsync.test",
        password="NewValidPass123!",
    )
    assert new_login.status_code == 200

    replay_response = client.post(
        "/api/auth/password-reset/confirm",
        json={
            "token": captured["token"],
            "new_password": "AnotherValidPass123!",
        },
    )
    assert replay_response.status_code == 400


def test_breached_password_check_fails_closed(monkeypatch):
    monkeypatch.setattr(auth_service, "ENABLE_HIBP_PASSWORD_CHECK", True)

    def raise_request_error(*args, **kwargs):
        raise auth_service.requests.RequestException("HIBP unavailable")

    monkeypatch.setattr(auth_service.requests, "get", raise_request_error)

    with pytest.raises(HTTPException) as exc_info:
        auth_service.is_password_breached("UniquePass123!")

    assert exc_info.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


def test_fixed_window_rate_limit_blocks_after_limit():
    auth_service.clear_ephemeral_security_state()

    assert auth_service.check_fixed_window_rate_limit(
        namespace="test",
        identifier="client",
        limit=1,
        window_seconds=60,
    )
    assert not auth_service.check_fixed_window_rate_limit(
        namespace="test",
        identifier="client",
        limit=1,
        window_seconds=60,
    )


def test_flag_hashes_are_hmac_bound_to_event():
    event_id = uuid.uuid4()
    other_event_id = uuid.uuid4()
    stored_hash = challenges._hash_flag("FLAG{demo}", event_id)

    assert stored_hash.startswith(challenges.FLAG_HASH_PREFIX)
    assert challenges._verify_flag("FLAG{demo}", stored_hash, event_id)
    assert not challenges._verify_flag("FLAG{demo}", stored_hash, other_event_id)

    legacy_hash = hashlib.sha256("FLAG{demo}".encode("utf-8")).hexdigest()
    assert challenges._verify_flag("FLAG{demo}", legacy_hash, event_id)


def test_flag_submission_rate_limit_raises_and_audits(client, monkeypatch):
    monkeypatch.setattr(challenges, "FLAG_SUBMISSION_RATE_LIMIT", 1)
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/challenges/example/submit",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        }
    )

    with SessionLocal() as db:
        role = get_role_by_name(db, "user")
        user = create_user(
            db,
            email="ratelimit@flagsync.test",
            display_name="Rate Limit User",
            password_hash=get_password_hash("ValidPass123!"),
            role_id=role.role_id,
        )
        user_id = user.user_id
        db.commit()

        challenges._enforce_submission_rate_limit(request, db, user_id)
        with pytest.raises(HTTPException) as exc_info:
            challenges._enforce_submission_rate_limit(request, db, user_id)

    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS


def test_resource_count_tracks_uploaded_files(client):
    with SessionLocal() as db:
        organiser_role = get_role_by_name(db, "organiser")
        organiser = create_user(
            db,
            email="organiser@flagsync.test",
            display_name="Organiser User",
            password_hash=get_password_hash("ValidPass123!"),
            role_id=organiser_role.role_id,
        )
        now = datetime.now(timezone.utc)
        db.add(
            Resource(
                resource_id=uuid.uuid4(),
                event_id=uuid.uuid4(),
                uploaded_by=organiser.user_id,
                file_name="guide.txt",
                storage_path="events/guide.txt",
                mime_type="text/plain",
                file_size=12,
                uploaded_at=now,
                updated_at=now,
            )
        )
        db.add(
            Resource(
                resource_id=uuid.uuid4(),
                event_id=uuid.uuid4(),
                uploaded_by=uuid.uuid4(),
                file_name="other.txt",
                storage_path="events/other.txt",
                mime_type="text/plain",
                file_size=12,
                uploaded_at=now,
                updated_at=now,
            )
        )
        db.commit()

        assert count_user_resources(db, organiser.user_id) == 1


def test_admin_can_read_audit_retention_status(client, monkeypatch, admin_user):
    with SessionLocal() as db:
        audit_log = create_audit_log(
            db,
            action_type="old_security_event",
            result="success",
        )
        audit_log.created_at = datetime.now(timezone.utc) - timedelta(days=120)
        db.commit()

    login_as_admin(client, monkeypatch, admin_user)
    response = client.get("/api/admin/audit-logs/retention")

    assert response.status_code == 200
    body = response.json()
    assert body["retention_days"] == 90
    assert body["archive_eligible_count"] >= 1
