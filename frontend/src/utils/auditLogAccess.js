import { getDashboardPath } from "./roleRoutes.js";

export function canAccessAuditLogs(role) {
  return getDashboardPath(role) === "/admin/dashboard";
}
