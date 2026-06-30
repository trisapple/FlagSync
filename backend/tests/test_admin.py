import pytest

from conftest import register_account, solve_registration_challenge
from app.services.auth_service import COOKIE_NAME


def login_as_admin(client, admin_user):
    response = client.post(
        "/api/auth/login",
        json={"email": admin_user["email"], "password": "AdminPass123!"},
    )
    assert response.status_code == 200
    return response


def get_participant_user_id(client) -> int:
    register_account(client, email="participant@flagsync.test")
    return None


class TestListAdminUsersAuth:
    def test_unauthenticated_request_returns_401(self, client):
        response = client.get("/api/admin/users")
        assert response.status_code == 401

    def test_participant_returns_403(self, client):
        register_account(client)
        client.post(
            "/api/auth/login",
            json={"email": "user@flagsync.test", "password": "ValidPass123!"},
        )
        response = client.get("/api/admin/users")
        assert response.status_code == 403

    def test_admin_can_list_users(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/users")
        assert response.status_code == 200
        body = response.json()
        assert "items" in body
        assert "total" in body
        assert "active_administrator_count" in body

    def test_response_contains_correct_user_fields(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/users")
        assert response.status_code == 200
        item = response.json()["items"][0]
        assert "user_id" in item
        assert "display_name" in item
        assert "email" in item
        assert "role_name" in item
        assert "is_active" in item
        assert "created_at" in item
        assert "password_hash" not in item

    def test_active_administrator_count_is_correct(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/users")
        assert response.json()["active_administrator_count"] >= 1


class TestListAdminUsersFilters:
    def test_search_filter_by_display_name(self, client, admin_user):
        register_account(
            client, email="alice@flagsync.test", display_name="Alice Wonder"
        )
        login_as_admin(client, admin_user)

        response = client.get("/api/admin/users?search=Alice")
        assert response.status_code == 200
        items = response.json()["items"]
        assert any("Alice" in i["display_name"] for i in items)

    def test_search_filter_by_email(self, client, admin_user):
        register_account(client, email="bob@flagsync.test", display_name="Bob Builder")
        login_as_admin(client, admin_user)

        response = client.get("/api/admin/users?search=bob@flagsync")
        assert response.status_code == 200
        items = response.json()["items"]
        assert any("bob@flagsync.test" in i["email"] for i in items)

    def test_role_filter(self, client, admin_user):
        register_account(client)
        login_as_admin(client, admin_user)

        response = client.get("/api/admin/users?role=participant")
        assert response.status_code == 200
        items = response.json()["items"]
        assert all(i["role_name"] == "participant" for i in items)

    def test_is_active_filter_true(self, client, admin_user):
        register_account(client)
        login_as_admin(client, admin_user)

        response = client.get("/api/admin/users?is_active=true")
        assert response.status_code == 200
        items = response.json()["items"]
        assert all(i["is_active"] is True for i in items)

    def test_pagination(self, client, admin_user):
        login_as_admin(client, admin_user)

        response = client.get("/api/admin/users?page=1&page_size=1")
        assert response.status_code == 200
        assert len(response.json()["items"]) <= 1

    def test_invalid_page_size_returns_422(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/users?page_size=0")
        assert response.status_code == 422


class TestUpdateUserStatus:
    def _get_participant_id(self, client, admin_user) -> int:
        register_account(client, email="target@flagsync.test")
        login_as_admin(client, admin_user)
        items = client.get("/api/admin/users?search=target@flagsync").json()["items"]
        return items[0]["user_id"]

    def test_unauthenticated_returns_401(self, client):
        response = client.patch(
            "/api/admin/users/1/status",
            json={"is_active": False, "reason": "Policy violation"},
        )
        assert response.status_code == 401

    def test_participant_returns_403(self, client):
        register_account(client)
        client.post(
            "/api/auth/login",
            json={"email": "user@flagsync.test", "password": "ValidPass123!"},
        )
        response = client.patch(
            "/api/admin/users/1/status",
            json={"is_active": False, "reason": "Policy violation"},
        )
        assert response.status_code == 403

    def test_suspend_user_sets_is_active_false(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        response = client.patch(
            f"/api/admin/users/{uid}/status",
            json={"is_active": False, "reason": "Policy violation"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["is_active"] is False

    def test_reactivate_user_sets_is_active_true(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        client.patch(
            f"/api/admin/users/{uid}/status",
            json={"is_active": False, "reason": "Policy violation"},
        )
        response = client.patch(
            f"/api/admin/users/{uid}/status",
            json={"is_active": True, "reason": "Appeal approved"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["is_active"] is True

    def test_missing_reason_returns_422(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.patch(
            "/api/admin/users/1/status",
            json={"is_active": False},
        )
        assert response.status_code == 422

    def test_reason_too_short_returns_422(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.patch(
            "/api/admin/users/1/status",
            json={"is_active": False, "reason": "ab"},
        )
        assert response.status_code == 422

    def test_user_not_found_returns_404(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.patch(
            "/api/admin/users/99999/status",
            json={"is_active": False, "reason": "Policy violation"},
        )
        assert response.status_code == 404

    def test_status_change_creates_audit_log(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        client.patch(
            f"/api/admin/users/{uid}/status",
            json={"is_active": False, "reason": "Policy violation"},
        )
        logs_response = client.get("/api/audit-logs")
        assert logs_response.status_code == 200
        actions = [log["action"] for log in logs_response.json()]
        assert "user_status_changed" in actions

    def test_audit_log_contains_no_sensitive_data(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        client.patch(
            f"/api/admin/users/{uid}/status",
            json={"is_active": False, "reason": "Policy violation"},
        )
        logs = client.get("/api/audit-logs").json()
        status_log = next(l for l in logs if l["action"] == "user_status_changed")
        forbidden = {"password", "password_hash", "token", "secret"}
        if status_log["details_json"]:
            assert not any(k in status_log["details_json"] for k in forbidden)

    def test_response_includes_message(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        response = client.patch(
            f"/api/admin/users/{uid}/status",
            json={"is_active": False, "reason": "Policy violation"},
        )
        assert "message" in response.json()
    
    def test_admin_cannot_suspend_themselves(self, client, admin_user):
        login_as_admin(client, admin_user)
        me = client.get("/api/auth/me").json()
        response = client.patch(
            f"/api/admin/users/{me['user_id']}/status",
            json={"is_active": False, "reason": "Self suspension attempt"},
        )
        assert response.status_code == 403

    def test_cannot_suspend_last_administrator(self, client, admin_user):
        login_as_admin(client, admin_user)
        me = client.get("/api/auth/me").json()
        response = client.patch(
            f"/api/admin/users/{me['user_id']}/status",
            json={"is_active": False, "reason": "Last admin suspension attempt"},
        )
        assert response.status_code == 403


class TestDeleteUser:
    def _get_participant_id(self, client, admin_user) -> int:
        register_account(client, email="todelete@flagsync.test")
        login_as_admin(client, admin_user)
        items = client.get("/api/admin/users?search=todelete").json()["items"]
        return items[0]["user_id"]

    def test_unauthenticated_returns_401(self, client):
        response = client.delete("/api/admin/users/1?reason=Policy+violation")
        assert response.status_code == 401

    def test_participant_returns_403(self, client):
        register_account(client)
        client.post(
            "/api/auth/login",
            json={"email": "user@flagsync.test", "password": "ValidPass123!"},
        )
        response = client.delete("/api/admin/users/1?reason=Policy+violation")
        assert response.status_code == 403

    def test_delete_scrubs_user_and_sets_inactive(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        response = client.delete(
            f"/api/admin/users/{uid}?reason=Requested+deletion",
        )
        assert response.status_code == 200
        body = response.json()
        assert body["user"]["is_active"] is False

    def test_user_not_found_returns_404(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.delete(
            "/api/admin/users/99999?reason=Requested+deletion",
        )
        assert response.status_code == 404

    def test_missing_reason_returns_422(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.delete("/api/admin/users/1")
        assert response.status_code == 422

    def test_delete_creates_audit_log(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        client.delete(f"/api/admin/users/{uid}?reason=Requested+deletion")
        logs = client.get("/api/audit-logs").json()
        actions = [log["action"] for log in logs]
        assert "admin_user_deleted" in actions
    
    def test_admin_cannot_delete_themselves(self, client, admin_user):
        login_as_admin(client, admin_user)
        me = client.get("/api/auth/me").json()
        response = client.delete(
            f"/api/admin/users/{me['user_id']}?reason=Self+deletion+attempt"
        )
        assert response.status_code == 403

    def test_cannot_delete_last_administrator(self, client, admin_user):
        login_as_admin(client, admin_user)
        me = client.get("/api/auth/me").json()
        response = client.delete(
            f"/api/admin/users/{me['user_id']}?reason=Last+admin+deletion+attempt"
        )
        assert response.status_code == 403


class TestUpdateUserRole:
    def _get_participant_id(self, client, admin_user) -> int:
        register_account(client, email="rolechange@flagsync.test")
        login_as_admin(client, admin_user)
        items = client.get("/api/admin/users?search=rolechange").json()["items"]
        return items[0]["user_id"]

    def test_unauthenticated_returns_401(self, client):
        response = client.patch(
            "/api/admin/users/1/role",
            json={"role_name": "organiser", "reason": "Approved request"},
        )
        assert response.status_code == 401

    def test_participant_returns_403(self, client):
        register_account(client)
        client.post(
            "/api/auth/login",
            json={"email": "user@flagsync.test", "password": "ValidPass123!"},
        )
        response = client.patch(
            "/api/admin/users/1/role",
            json={"role_name": "organiser", "reason": "Approved request"},
        )
        assert response.status_code == 403

    def test_promote_to_organiser(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        response = client.patch(
            f"/api/admin/users/{uid}/role",
            json={"role_name": "organiser", "reason": "Approved organiser request"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["role_name"] == "organiser"

    def test_promote_to_administrator(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        response = client.patch(
            f"/api/admin/users/{uid}/role",
            json={"role_name": "administrator", "reason": "Elevated privileges required"},
        )
        assert response.status_code == 200
        assert response.json()["user"]["role_name"] == "administrator"

    def test_invalid_role_returns_422(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.patch(
            "/api/admin/users/1/role",
            json={"role_name": "superuser", "reason": "Test"},
        )
        assert response.status_code == 422

    def test_missing_reason_returns_422(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.patch(
            "/api/admin/users/1/role",
            json={"role_name": "organiser"},
        )
        assert response.status_code == 422

    def test_reason_too_short_returns_422(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.patch(
            "/api/admin/users/1/role",
            json={"role_name": "organiser", "reason": "ab"},
        )
        assert response.status_code == 422

    def test_user_not_found_returns_404(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.patch(
            "/api/admin/users/99999/role",
            json={"role_name": "organiser", "reason": "Approved organiser request"},
        )
        assert response.status_code == 404

    def test_inactive_user_cannot_change_role(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        # deactivate first
        client.patch(
            f"/api/admin/users/{uid}/status",
            json={"is_active": False, "reason": "Suspended for testing"},
        )
        response = client.patch(
            f"/api/admin/users/{uid}/role",
            json={"role_name": "organiser", "reason": "Approved organiser request"},
        )
        assert response.status_code == 409

    def test_role_change_creates_audit_log(self, client, admin_user):
        uid = self._get_participant_id(client, admin_user)
        client.patch(
            f"/api/admin/users/{uid}/role",
            json={"role_name": "organiser", "reason": "Approved organiser request"},
        )
        logs = client.get("/api/audit-logs").json()
        actions = [log["action"] for log in logs]
        assert "user_role_changed" in actions

    def test_admin_cannot_change_own_role(self, client, admin_user):
        login_as_admin(client, admin_user)
        me = client.get("/api/auth/me").json()
        response = client.patch(
            f"/api/admin/users/{me['user_id']}/role",
            json={"role_name": "participant", "reason": "Self demotion attempt"},
        )
        assert response.status_code == 403

    def test_cannot_demote_last_administrator(self, client, admin_user):
        login_as_admin(client, admin_user)
        me = client.get("/api/auth/me").json()
        response = client.patch(
            f"/api/admin/users/{me['user_id']}/role",
            json={"role_name": "participant", "reason": "Last admin demotion attempt"},
        )
        assert response.status_code == 403


class TestListAdminAuditLogs:
    def test_unauthenticated_returns_401(self, client):
        response = client.get("/api/admin/audit-logs")
        assert response.status_code == 401

    def test_participant_returns_403(self, client):
        register_account(client)
        client.post(
            "/api/auth/login",
            json={"email": "user@flagsync.test", "password": "ValidPass123!"},
        )
        response = client.get("/api/admin/audit-logs")
        assert response.status_code == 403

    def test_admin_can_list_audit_logs(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/audit-logs")
        assert response.status_code == 200
        body = response.json()
        assert "items" in body
        assert "total" in body

    def test_log_fields_match_schema(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/audit-logs")
        assert response.status_code == 200
        items = response.json()["items"]
        assert len(items) > 0
        item = items[0]
        assert "audit_log_id" in item
        assert "action" in item
        assert "created_at" in item
        assert "actor_user_id" in item

    def test_no_patch_or_delete_on_audit_logs(self, client, admin_user):
        login_as_admin(client, admin_user)
        assert client.patch("/api/admin/audit-logs/1").status_code in (404, 405)
        assert client.delete("/api/admin/audit-logs/1").status_code in (404, 405)

    def test_action_type_filter(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/audit-logs?action=login_success")
        assert response.status_code == 200
        items = response.json()["items"]
        assert all("login_success" in i["action"] for i in items)

    def test_actor_filter(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get(f"/api/admin/audit-logs?actor_user_id={1}")
        assert response.status_code == 200

    def test_pagination(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/audit-logs?page=1&page_size=1")
        assert response.status_code == 200
        assert len(response.json()["items"]) <= 1

    def test_invalid_page_size_returns_422(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/audit-logs?page_size=0")
        assert response.status_code == 422

    def test_no_cache_header_on_admin_audit_logs(self, client, admin_user):
        login_as_admin(client, admin_user)
        response = client.get("/api/admin/audit-logs")
        assert response.headers.get("cache-control") == "no-store"
