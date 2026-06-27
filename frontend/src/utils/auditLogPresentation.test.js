import test from "node:test";
import assert from "node:assert/strict";
import { canAccessAuditLogs } from "./auditLogAccess.js";
import {
  formatAuditAction,
  getSafeAuditDetails,
  normalizeAuditLog,
} from "./auditLogPresentation.js";

test("formats machine action names for display", () => {
  assert.equal(formatAuditAction("USER_ROLE_CHANGED"), "User role changed");
  assert.equal(formatAuditAction("account.status-updated"), "Account status updated");
  assert.equal(formatAuditAction(null), "Unknown action");
});

test("normalizes current and legacy audit column names", () => {
  const normalized = normalizeAuditLog({
    log_id: "log-1",
    timestamp: "2026-06-27T04:00:00Z",
    affected_resource: "user",
    action_type: "USER_SUSPENDED",
  });
  assert.equal(normalized.created_at, "2026-06-27T04:00:00Z");
  assert.equal(normalized.resource_type, "user");
  assert.equal(normalized.result, "unknown");
  assert.equal(normalized.actor_user_id, null);
});

test("only exposes explicitly allowed safe detail fields", () => {
  const safeDetails = getSafeAuditDetails({
    reason: "Policy violation",
    previous_status: "active",
    new_status: "suspended",
    password_hash: "must-not-render",
    jwt: "must-not-render",
    raw_request_body: { password: "must-not-render" },
    stack_trace: "must-not-render",
  });
  assert.deepEqual(
    safeDetails.map((detail) => detail.key),
    ["reason", "previous_status", "new_status"],
  );
});

test("rejects nested and oversized detail values", () => {
  assert.deepEqual(getSafeAuditDetails({ reason: { raw: "unsafe" } }), []);
  assert.deepEqual(
    getSafeAuditDetails({ changed_fields: Array.from({ length: 21 }, (_, i) => i) }),
    [],
  );
});

test("only allows administrator roles to access audit logs", () => {
  assert.equal(canAccessAuditLogs("administrator"), true);
  assert.equal(canAccessAuditLogs("admin"), true);
  assert.equal(canAccessAuditLogs("organiser"), false);
  assert.equal(canAccessAuditLogs("user"), false);
});
