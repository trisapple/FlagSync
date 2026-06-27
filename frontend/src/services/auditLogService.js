import apiClient from "../api/axiosClient";
import { normalizeAuditLog } from "../utils/auditLogPresentation";

export async function getAuditLogs(params) {
  const response = await apiClient.get("/admin/audit-logs", { params });
  const payload = response.data;
  const items = Array.isArray(payload) ? payload : (payload.items ?? payload.logs ?? []);

  return {
    items: items
      .map(normalizeAuditLog)
      .sort((first, second) =>
        String(second.created_at).localeCompare(String(first.created_at)),
      ),
    total: Array.isArray(payload) ? payload.length : (payload.total ?? items.length),
  };
}
