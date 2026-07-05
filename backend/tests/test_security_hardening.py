import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException, Request, status
from sqlalchemy import select

from app.database import SessionLocal
from app.models.audit_log import AuditLog
from app.models.event import Event
from app.models.resource import Resource
from app.repositories.audit_log_repository import create_audit_log
from app.repositories.role_repository import get_role_by_name
from app.repositories.user_repository import create_user
from app.routers import auth_router, challenges, resources
from app.services import auth_service
from app.services.auth_service import get_password_hash

from conftest import register_account


def complete_login(client, monkeypatch, *, email: str, password: str):
    captured = {}

    def capture_login_otp(user_id):
        intent_id, otp = auth_service.create_login_otp(user_id)
        captured["otp"] = otp
        return intent_id, otp

    monkeypatch.setattr(auth_router, "create_login_otp", capture_login_otp)
    login_response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    login_intent_id = login_response.json()["login_intent_id"]

    otp_response = client.post(
        "/api/auth/login/verify-otp",
        json={
            "login_intent_id": login_intent_id,
            "otp": captured["otp"],
        },
    )
    assert otp_response.status_code == 200
    return otp_response


def login_as_admin(client, monkeypatch, admin_user):
    return complete_login(
        client,
        monkeypatch,
        email=admin_user["email"],
        password="AdminPass123!",
    )


def create_role_user(
    *,
    email: str,
    display_name: str,
    password: str,
    role_name: str,
):
    with SessionLocal() as db:
        role = get_role_by_name(db, role_name)
        user = create_user(
            db,
            email=email,
            display_name=display_name,
            password_hash=get_password_hash(password),
            role_id=role.role_id,
        )
        user_id = user.user_id
        db.commit()
        return user_id


def test_password_reset_flow_changes_password_and_rejects_token_replay(
    client,
    monkeypatch,
):
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

    complete_login(
        client,
        monkeypatch,
        email="resetme@flagsync.test",
        password="NewValidPass123!",
    )

    replay_response = client.post(
        "/api/auth/password-reset/confirm",
        json={
            "token": captured["token"],
            "new_password": "AnotherValidPass123!",
        },
    )
    assert replay_response.status_code == 400


def test_password_reset_request_does_not_reveal_unknown_email(client):
    response = client.post(
        "/api/auth/password-reset/request",
        json={"email": "missing@flagsync.test"},
    )

    assert response.status_code == 200
    assert response.json()["reset_token"] is None


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
    user_id = create_role_user(
        email="ratelimit@flagsync.test",
        display_name="Rate Limit User",
        password="ValidPass123!",
        role_name="user",
    )
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
        challenges._enforce_submission_rate_limit(request, db, user_id)
        with pytest.raises(HTTPException) as exc_info:
            challenges._enforce_submission_rate_limit(request, db, user_id)

        audit_log = db.scalar(
            select(AuditLog).where(
                AuditLog.action_type == "flag_submission_rate_limited"
            )
        )

    assert exc_info.value.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert audit_log is not None


def test_resource_upload_file_count_quota_blocks_extra_upload(
    client,
    monkeypatch,
):
    monkeypatch.setattr(resources, "USER_QUOTA_FILE_COUNT", 1)
    monkeypatch.setattr(resources, "is_configured", lambda: True)
    monkeypatch.setattr(resources, "upload_file", lambda **kwargs: True)

    organiser_id = create_role_user(
        email="quota-organiser@flagsync.test",
        display_name="Quota Organiser",
        password="ValidPass123!",
        role_name="organiser",
    )
    now = datetime.now(timezone.utc)
    event_id = uuid.uuid4()

    with SessionLocal() as db:
        db.add(
            Event(
                event_id=event_id,
                organiser_id=organiser_id,
                event_name="Quota Test Event",
                description=None,
                event_type="ctf",
                event_format="online",
                location="Online",
                start_date=now + timedelta(days=1),
                end_date=now + timedelta(days=2),
                registration_deadline=now,
                capacity=100,
                team_mode=False,
                max_team_size=1,
                leaderboard_visible=True,
                status="published",
                created_at=now,
                updated_at=now,
            )
        )
        db.add(
            Resource(
                resource_id=uuid.uuid4(),
                event_id=event_id,
                uploaded_by=organiser_id,
                file_name="existing.txt",
                storage_path="events/existing.txt",
                mime_type="text/plain",
                file_size=12,
                uploaded_at=now,
                updated_at=now,
            )
        )
        db.commit()

    complete_login(
        client,
        monkeypatch,
        email="quota-organiser@flagsync.test",
        password="ValidPass123!",
    )
    response = client.post(
        f"/api/events/{event_id}/resources",
        files={"file": ("new.txt", b"hello", "text/plain")},
    )

    assert response.status_code == status.HTTP_413_CONTENT_TOO_LARGE


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
