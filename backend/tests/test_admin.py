import uuid

from app.routers import auth_router
from app.services import auth_service
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
    intent_id = login_response.json()["login_intent_id"]

    otp_response = client.post(
        "/api/auth/login/verify-otp",
        json={"login_intent_id": intent_id, "otp": captured["otp"]},
    )
    assert otp_response.status_code == 200
    return otp_response


def login_as_admin(client, monkeypatch, admin_user):
    return complete_login(
        client, monkeypatch, email=admin_user["email"], password="AdminPass123!"
    )


def register_and_get_user_id(client, monkeypatch, admin_user, email: str) -> str:
    register_account(client, email=email)
    login_as_admin(client, monkeypatch, admin_user)
    items = client.get(f"/api/admin/users?search={email}").json()["items"]
    return items[0]["user_id"]


class TestListAdminUsersAuth:
    def test_unauthenticated_returns_401(self, client):
        assert client.get("/api/admin/users").status_code == 401

    def test_regular_user_returns_403(self, client, monkeypatch):
        register_account(client)
        complete_login(
            client,
            monkeypatch,
            email="user@flagsync.test",
            password="ValidPass123!",
        )
        assert client.get("/api/admin/users").status_code == 403

    def test_admin_can_list_users(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        response = client.get("/api/admin/users")
        assert response.status_code == 200
        body = response.json()
        assert "items" in body
        assert "total" in body
        assert "active_administrator_count" in body

    def test_response_fields_correct_no_sensitive_data(
        self, client, monkeypatch, admin_user
    ):
        login_as_admin(client, monkeypatch, admin_user)
        item = client.get("/api/admin/users").json()["items"][0]
        assert "user_id" in item
        assert "display_name" in item
        assert "email" in item
        assert "role_name" in item
        assert "account_status" in item
        assert "created_at" in item
        assert "password_hash" not in item

    def test_active_administrator_count_correct(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert client.get("/api/admin/users").json()["active_administrator_count"] >= 1


class TestListAdminUsersFilters:
    def test_search_by_display_name(self, client, monkeypatch, admin_user):
        register_account(
            client, email="alice@flagsync.test", display_name="Alice Wonder"
        )
        login_as_admin(client, monkeypatch, admin_user)
        items = client.get("/api/admin/users?search=Alice").json()["items"]
        assert any("Alice" in i["display_name"] for i in items)

    def test_search_by_email(self, client, monkeypatch, admin_user):
        register_account(client, email="bob@flagsync.test")
        login_as_admin(client, monkeypatch, admin_user)
        items = client.get("/api/admin/users?search=bob@flagsync").json()["items"]
        assert any("bob@flagsync.test" in i["email"] for i in items)

    def test_role_filter(self, client, monkeypatch, admin_user):
        register_account(client)
        login_as_admin(client, monkeypatch, admin_user)
        items = client.get("/api/admin/users?role=user").json()["items"]
        assert all(i["role_name"] == "user" for i in items)

    def test_account_status_filter(self, client, monkeypatch, admin_user):
        register_account(client)
        login_as_admin(client, monkeypatch, admin_user)
        items = client.get("/api/admin/users?account_status=active").json()["items"]
        assert all(i["account_status"] == "active" for i in items)

    def test_pagination(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            len(client.get("/api/admin/users?page=1&page_size=1").json()["items"]) <= 1
        )

    def test_invalid_page_size_returns_422(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert client.get("/api/admin/users?page_size=0").status_code == 422


class TestUpdateUserStatus:
    def _uid(self, client, monkeypatch, admin_user, email="target@flagsync.test"):
        return register_and_get_user_id(client, monkeypatch, admin_user, email)

    def test_unauthenticated_returns_401(self, client):
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/status",
                json={"account_status": "suspended", "reason": "Policy violation"},
            ).status_code
            == 401
        )

    def test_regular_user_returns_403(self, client, monkeypatch):
        register_account(client)
        complete_login(
            client, monkeypatch, email="user@flagsync.test", password="ValidPass123!"
        )
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/status",
                json={"account_status": "suspended", "reason": "Policy violation"},
            ).status_code
            == 403
        )

    def test_suspend_sets_account_status_suspended(
        self, client, monkeypatch, admin_user
    ):
        uid = self._uid(client, monkeypatch, admin_user)
        response = client.patch(
            f"/api/admin/users/{uid}/status",
            json={"account_status": "suspended", "reason": "Policy violation"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["account_status"] == "suspended"

    def test_reactivate_sets_account_status_active(
        self, client, monkeypatch, admin_user
    ):
        uid = self._uid(client, monkeypatch, admin_user)
        client.patch(
            f"/api/admin/users/{uid}/status",
            json={"account_status": "suspended", "reason": "Policy violation"},
        )
        response = client.patch(
            f"/api/admin/users/{uid}/status",
            json={"account_status": "active", "reason": "Appeal approved"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["account_status"] == "active"

    def test_invalid_status_returns_422(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/status",
                json={"account_status": "banned", "reason": "Test"},
            ).status_code
            == 422
        )

    def test_missing_reason_returns_422(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/status",
                json={"account_status": "suspended"},
            ).status_code
            == 422
        )

    def test_reason_too_short_returns_422(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/status",
                json={"account_status": "suspended", "reason": "ab"},
            ).status_code
            == 422
        )

    def test_user_not_found_returns_404(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/status",
                json={"account_status": "suspended", "reason": "Policy violation"},
            ).status_code
            == 404
        )

    def test_response_includes_message(self, client, monkeypatch, admin_user):
        uid = self._uid(client, monkeypatch, admin_user)
        response = client.patch(
            f"/api/admin/users/{uid}/status",
            json={"account_status": "suspended", "reason": "Policy violation"},
        )
        assert "message" in response.json()

    def test_status_change_creates_audit_log(self, client, monkeypatch, admin_user):
        uid = self._uid(client, monkeypatch, admin_user)
        client.patch(
            f"/api/admin/users/{uid}/status",
            json={"account_status": "suspended", "reason": "Policy violation"},
        )
        logs = client.get("/api/audit-logs").json()
        assert any(log["action_type"] == "user_status_changed" for log in logs)

    def test_audit_log_contains_no_sensitive_data(
        self, client, monkeypatch, admin_user
    ):
        uid = self._uid(client, monkeypatch, admin_user)
        client.patch(
            f"/api/admin/users/{uid}/status",
            json={"account_status": "suspended", "reason": "Policy violation"},
        )
        logs = client.get("/api/audit-logs").json()
        log = next(
            entry for entry in logs if entry["action_type"] == "user_status_changed"
        )
        if log["details"]:
            forbidden = {"password", "password_hash", "token", "secret"}
            assert not forbidden.intersection(set(log["details"].keys()))

    def test_admin_cannot_suspend_themselves(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        me = client.get("/api/auth/me").json()
        assert (
            client.patch(
                f"/api/admin/users/{me['user_id']}/status",
                json={
                    "account_status": "suspended",
                    "reason": "Self suspension attempt",
                },
            ).status_code
            == 403
        )

    def test_cannot_suspend_last_administrator(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        me = client.get("/api/auth/me").json()
        assert (
            client.patch(
                f"/api/admin/users/{me['user_id']}/status",
                json={
                    "account_status": "suspended",
                    "reason": "Last admin lockout attempt",
                },
            ).status_code
            == 403
        )


class TestDeleteUser:
    def _uid(self, client, monkeypatch, admin_user, email="todelete@flagsync.test"):
        return register_and_get_user_id(client, monkeypatch, admin_user, email)

    def test_unauthenticated_returns_401(self, client):
        assert (
            client.delete(
                f"/api/admin/users/{uuid.uuid4()}?reason=Requested+deletion"
            ).status_code
            == 401
        )

    def test_regular_user_returns_403(self, client, monkeypatch):
        register_account(client)
        complete_login(
            client, monkeypatch, email="user@flagsync.test", password="ValidPass123!"
        )
        assert (
            client.delete(
                f"/api/admin/users/{uuid.uuid4()}?reason=Requested+deletion"
            ).status_code
            == 403
        )

    def test_delete_scrubs_user(self, client, monkeypatch, admin_user):
        uid = self._uid(client, monkeypatch, admin_user)
        response = client.delete(f"/api/admin/users/{uid}?reason=Requested+deletion")
        assert response.status_code == 200
        assert response.json()["user"]["account_status"] == "deleted"

    def test_user_not_found_returns_404(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            client.delete(
                f"/api/admin/users/{uuid.uuid4()}?reason=Requested+deletion"
            ).status_code
            == 404
        )

    def test_missing_reason_returns_422(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert client.delete(f"/api/admin/users/{uuid.uuid4()}").status_code == 422

    def test_delete_creates_audit_log(self, client, monkeypatch, admin_user):
        uid = self._uid(client, monkeypatch, admin_user)
        client.delete(f"/api/admin/users/{uid}?reason=Requested+deletion")
        logs = client.get("/api/audit-logs").json()
        assert any(log["action_type"] == "admin_user_deleted" for log in logs)

    def test_admin_cannot_delete_themselves(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        me = client.get("/api/auth/me").json()
        assert (
            client.delete(
                f"/api/admin/users/{me['user_id']}?reason=Self+deletion+attempt"
            ).status_code
            == 403
        )

    def test_cannot_delete_last_administrator(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        me = client.get("/api/auth/me").json()
        assert (
            client.delete(
                f"/api/admin/users/{me['user_id']}?reason=Last+admin+deletion"
            ).status_code
            == 403
        )


class TestUpdateUserRole:
    def _uid(self, client, monkeypatch, admin_user, email="rolechange@flagsync.test"):
        return register_and_get_user_id(client, monkeypatch, admin_user, email)

    def test_unauthenticated_returns_401(self, client):
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/role",
                json={"role_name": "organiser", "reason": "Approved request"},
            ).status_code
            == 401
        )

    def test_regular_user_returns_403(self, client, monkeypatch):
        register_account(client)
        complete_login(
            client, monkeypatch, email="user@flagsync.test", password="ValidPass123!"
        )
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/role",
                json={"role_name": "organiser", "reason": "Approved request"},
            ).status_code
            == 403
        )

    def test_promote_to_organiser(self, client, monkeypatch, admin_user):
        uid = self._uid(client, monkeypatch, admin_user)
        response = client.patch(
            f"/api/admin/users/{uid}/role",
            json={"role_name": "organiser", "reason": "Approved organiser request"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["role_name"] == "organiser"

    def test_promote_to_administrator(self, client, monkeypatch, admin_user):
        uid = self._uid(client, monkeypatch, admin_user)
        response = client.patch(
            f"/api/admin/users/{uid}/role",
            json={
                "role_name": "administrator",
                "reason": "Elevated privileges required",
            },
        )
        assert response.status_code == 200
        assert response.json()["user"]["role_name"] == "administrator"

    def test_invalid_role_returns_422(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/role",
                json={"role_name": "superuser", "reason": "Test"},
            ).status_code
            == 422
        )

    def test_missing_reason_returns_422(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/role",
                json={"role_name": "organiser"},
            ).status_code
            == 422
        )

    def test_reason_too_short_returns_422(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/role",
                json={"role_name": "organiser", "reason": "ab"},
            ).status_code
            == 422
        )

    def test_user_not_found_returns_404(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            client.patch(
                f"/api/admin/users/{uuid.uuid4()}/role",
                json={"role_name": "organiser", "reason": "Approved request"},
            ).status_code
            == 404
        )

    def test_suspended_user_cannot_change_role(self, client, monkeypatch, admin_user):
        uid = self._uid(client, monkeypatch, admin_user)
        client.patch(
            f"/api/admin/users/{uid}/status",
            json={"account_status": "suspended", "reason": "Suspended for testing"},
        )
        assert (
            client.patch(
                f"/api/admin/users/{uid}/role",
                json={"role_name": "organiser", "reason": "Approved request"},
            ).status_code
            == 409
        )

    def test_role_change_creates_audit_log(self, client, monkeypatch, admin_user):
        uid = self._uid(client, monkeypatch, admin_user)
        client.patch(
            f"/api/admin/users/{uid}/role",
            json={"role_name": "organiser", "reason": "Approved organiser request"},
        )
        logs = client.get("/api/audit-logs").json()
        assert any(log["action_type"] == "user_role_changed" for log in logs)

    def test_admin_cannot_change_own_role(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        me = client.get("/api/auth/me").json()
        assert (
            client.patch(
                f"/api/admin/users/{me['user_id']}/role",
                json={"role_name": "user", "reason": "Self demotion attempt"},
            ).status_code
            == 403
        )

    def test_cannot_demote_last_administrator(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        me = client.get("/api/auth/me").json()
        assert (
            client.patch(
                f"/api/admin/users/{me['user_id']}/role",
                json={"role_name": "user", "reason": "Last admin demotion attempt"},
            ).status_code
            == 403
        )


class TestListAdminAuditLogs:
    def test_unauthenticated_returns_401(self, client):
        assert client.get("/api/admin/audit-logs").status_code == 401

    def test_regular_user_returns_403(self, client, monkeypatch):
        register_account(client)
        complete_login(
            client, monkeypatch, email="user@flagsync.test", password="ValidPass123!"
        )
        assert client.get("/api/admin/audit-logs").status_code == 403

    def test_admin_can_list_audit_logs(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        response = client.get("/api/admin/audit-logs")
        assert response.status_code == 200
        body = response.json()
        assert "items" in body
        assert "total" in body

    def test_log_fields_match_model(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        items = client.get("/api/admin/audit-logs").json()["items"]
        assert len(items) > 0
        item = items[0]
        assert "log_id" in item
        assert "action_type" in item
        assert "created_at" in item
        assert "actor_user_id" in item

    def test_no_patch_or_delete_on_audit_logs(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert client.patch("/api/admin/audit-logs/1").status_code in (404, 405)
        assert client.delete("/api/admin/audit-logs/1").status_code in (404, 405)

    def test_action_type_filter(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        response = client.get("/api/admin/audit-logs?action_type=login_otp_verified")
        assert response.status_code == 200
        items = response.json()["items"]
        assert all("login_otp_verified" in i["action_type"] for i in items)

    def test_pagination(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert (
            len(client.get("/api/admin/audit-logs?page=1&page_size=1").json()["items"])
            <= 1
        )

    def test_invalid_page_size_returns_422(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        assert client.get("/api/admin/audit-logs?page_size=0").status_code == 422

    def test_no_cache_header(self, client, monkeypatch, admin_user):
        login_as_admin(client, monkeypatch, admin_user)
        response = client.get("/api/admin/audit-logs")
        assert response.headers.get("cache-control") == "no-store"
