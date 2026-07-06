import uuid

from conftest import register_account
from test_admin import complete_login, login_as_admin


USER_EMAIL = "applicant@flagsync.test"
USER_PASSWORD = "ValidPass123!"


def login_as_user(client, monkeypatch, *, email: str = USER_EMAIL):
    register_account(client, email=email)
    complete_login(client, monkeypatch, email=email, password=USER_PASSWORD)


def submit_request(client, reason: str | None = "I want to run a CTF."):
    return client.post("/api/organiser-requests", json={"reason": reason})


def test_user_can_submit_request(client, monkeypatch):
    login_as_user(client, monkeypatch)
    response = submit_request(client)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["decided_by"] is None


def test_duplicate_pending_request_returns_409(client, monkeypatch):
    login_as_user(client, monkeypatch)
    assert submit_request(client).status_code == 201
    assert submit_request(client).status_code == 409


def test_approve_nonexistent_request_returns_404(client, monkeypatch, admin_user):
    login_as_admin(client, monkeypatch, admin_user)
    response = client.post(
        f"/api/admin/organiser-requests/{uuid.uuid4()}/approve",
    )
    assert response.status_code == 404


def test_regular_user_cannot_approve_requests(client, monkeypatch):
    login_as_user(client, monkeypatch)
    response = client.post(
        f"/api/admin/organiser-requests/{uuid.uuid4()}/approve",
    )
    assert response.status_code == 403


def test_admin_approve_promotes_user_and_writes_audit_logs(
    client, monkeypatch, admin_user
):
    login_as_user(client, monkeypatch)
    request_id = submit_request(client).json()["request_id"]
    login_as_admin(client, monkeypatch, admin_user)

    response = client.post(f"/api/admin/organiser-requests/{request_id}/approve")
    assert response.status_code == 200
    assert response.json()["status"] == "approved"

    users = client.get(f"/api/admin/users?search={USER_EMAIL}").json()["items"]
    assert users[0]["role_name"] == "organiser"

    action_types = {log["action_type"] for log in client.get("/api/audit-logs").json()}
    assert "organiser_request_approved" in action_types
    assert "user_role_changed" in action_types
