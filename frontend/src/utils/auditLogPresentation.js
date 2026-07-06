const SAFE_DETAIL_FIELDS = [
  ["reason", "Reason"],
  ["previous_status", "Previous status"],
  ["new_status", "New status"],
  ["previous_role", "Previous role"],
  ["new_role", "New role"],
  ["target_user_id", "Target user ID"],
  ["target_email", "Target email"],
  ["event_id", "Event ID"],
  ["event_name", "Event name"],
  ["registration_status", "Registration status"],
  ["changed_fields", "Changed fields"],
];

function isSafeDisplayValue(value) {
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  return (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every((item) => ["string", "number", "boolean"].includes(typeof item))
  );
}

export function formatAuditAction(actionType) {
  if (!actionType) return "Unknown action";
  const readable = actionType
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim()
    .toLowerCase();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export function normalizeAuditLog(log) {
  return {
    log_id: log.log_id,
    created_at: log.created_at ?? log.timestamp,
    actor_user_id: log.actor_user_id ?? null,
    actor_display_name: log.actor_display_name ?? null,
    actor_email: log.actor_email ?? null,
    action_type: log.action_type,
    resource_type: log.resource_type ?? log.affected_resource ?? null,
    resource_id: log.resource_id ?? null,
    result: log.result ?? "unknown",
    details: log.details,
  };
}

export function getSafeAuditDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];

  return SAFE_DETAIL_FIELDS.flatMap(([key, label]) => {
    const value = details[key];
    return isSafeDisplayValue(value) ? [{ key, label, value }] : [];
  });
}
