import apiClient from "../api/axiosClient";

export async function getMyOrganiserRequest() {
  const response = await apiClient.get("/organiser-requests/mine");
  return response.data;
}

export async function submitOrganiserRequest(reason) {
  const response = await apiClient.post("/organiser-requests", {
    reason: reason || null,
  });
  return response.data;
}

export async function listOrganiserRequestsForAdmin(statusFilter = null) {
  const url = statusFilter
    ? `/admin/organiser-requests?status=${encodeURIComponent(statusFilter)}`
    : "/admin/organiser-requests";
  const response = await apiClient.get(url);
  return response.data;
}

export async function approveOrganiserRequest(requestId) {
  const response = await apiClient.post(
    `/admin/organiser-requests/${requestId}/approve`,
  );
  return response.data;
}

export async function rejectOrganiserRequest(requestId) {
  const response = await apiClient.post(
    `/admin/organiser-requests/${requestId}/reject`,
  );
  return response.data;
}
