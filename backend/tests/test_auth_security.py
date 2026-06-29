from app.routers import auth_router
from app.services import auth_service
from app.services.auth_service import COOKIE_NAME

from conftest import register_account, solve_registration_challenge


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
    return otp_response


def test_register_login_profile_update_and_logout_revocation(client, monkeypatch):
    register_account(client)

    login_response = complete_login(
        client,
        monkeypatch,
        email="user@flagsync.test",
        password="ValidPass123!",
    )
    assert login_response.status_code == 200
    assert login_response.json()["user"]["role_name"] == "user"
    assert COOKIE_NAME in client.cookies
    assert "httponly" in login_response.headers["set-cookie"].lower()
    assert "samesite=strict" in login_response.headers["set-cookie"].lower()

    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "user@flagsync.test"

    update_response = client.patch(
        "/api/auth/me",
        json={"display_name": "Updated User", "email": "user@flagsync.test"},
    )
    assert update_response.status_code == 200
    assert client.get("/api/auth/me").status_code == 401

    login_again_response = complete_login(
        client,
        monkeypatch,
        email="user@flagsync.test",
        password="ValidPass123!",
    )
    assert login_again_response.status_code == 200

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_registration_rejects_invalid_challenge_and_breached_password(client):
    bad_challenge_response = client.post(
        "/api/auth/register",
        json={
            "email": "bad@flagsync.test",
            "display_name": "Bad User",
            "password": "ValidPass123!",
            "challenge_id": "not-a-real-challenge-id",
            "challenge_answer": "flag-nope",
        },
    )
    assert bad_challenge_response.status_code == 400

    challenge_id, answer = solve_registration_challenge(client)
    breached_password_response = client.post(
        "/api/auth/register",
        json={
            "email": "breached@flagsync.test",
            "display_name": "Breach User",
            "password": "Password123!",
            "challenge_id": challenge_id,
            "challenge_answer": answer,
        },
    )
    assert breached_password_response.status_code == 422


def test_login_lockout_after_failed_attempts(client):
    register_account(client)

    for attempt in range(1, 6):
        response = client.post(
            "/api/auth/login",
            json={"email": "user@flagsync.test", "password": "WrongPass123!"},
        )
        expected_status = 429 if attempt == 5 else 401
        assert response.status_code == expected_status

    locked_response = client.post(
        "/api/auth/login",
        json={"email": "user@flagsync.test", "password": "ValidPass123!"},
    )
    assert locked_response.status_code == 429


def test_sensitive_auth_responses_include_security_headers(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.headers["strict-transport-security"]
    assert response.headers["content-security-policy"]
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["cache-control"] == "no-store"


def test_participant_cannot_read_roles(client, monkeypatch):
    register_account(client)
    login_response = complete_login(
        client,
        monkeypatch,
        email="user@flagsync.test",
        password="ValidPass123!",
    )
    assert login_response.status_code == 200

    response = client.get("/api/roles")
    assert response.status_code == 403


def test_admin_can_read_audit_logs(client, admin_user, monkeypatch):
    login_response = complete_login(
        client,
        monkeypatch,
        email=admin_user["email"],
        password="AdminPass123!",
    )
    assert login_response.status_code == 200

    response = client.get("/api/audit-logs")
    assert response.status_code == 200
    assert any(log["action_type"] == "login_success" for log in response.json())
