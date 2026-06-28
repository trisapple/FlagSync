import base64
import os

import pytest
from fastapi.testclient import TestClient

os.environ["SQLITE_DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-at-least-thirty-two-bytes"
os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = "100"
os.environ["EMAIL_VERIFICATION_REQUIRED"] = "false"
os.environ["ENABLE_HIBP_PASSWORD_CHECK"] = "false"

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import _seed_reference_data, app  # noqa: E402
from app.repositories.role_repository import get_role_by_name  # noqa: E402
from app.repositories.user_repository import create_user  # noqa: E402
from app.services.auth_service import (  # noqa: E402
    clear_ephemeral_security_state,
    get_password_hash,
)


@pytest.fixture()
def client():
    clear_ephemeral_security_state()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    _seed_reference_data()

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def admin_user():
    with SessionLocal() as db:
        admin_role = get_role_by_name(db, "administrator")
        user = create_user(
            db,
            email="admin@flagsync.test",
            display_name="Admin User",
            password_hash=get_password_hash("AdminPass123!"),
            role_id=admin_role.role_id,
        )
        admin_email = user.email
        db.commit()
        return {"email": admin_email}


def solve_registration_challenge(client: TestClient) -> tuple[str, str]:
    response = client.get("/api/auth/register/challenge")
    assert response.status_code == 200
    payload = response.json()
    encoded_answer = payload["prompt"].split(": ", maxsplit=1)[1]
    answer = base64.b64decode(encoded_answer).decode("utf-8")
    return payload["challenge_id"], answer


def register_account(
    client: TestClient,
    *,
    email: str = "user@flagsync.test",
    display_name: str = "Test User",
    password: str = "ValidPass123!",
) -> None:
    challenge_id, answer = solve_registration_challenge(client)
    response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "display_name": display_name,
            "password": password,
            "challenge_id": challenge_id,
            "challenge_answer": answer,
        },
    )
    assert response.status_code == 201
