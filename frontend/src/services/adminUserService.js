import apiClient from "../api/axiosClient";

export async function getAdminUsers(params) {
  const response = await apiClient.get("/admin/users", { params });
  return response.data;
}

export async function updateAdminUserStatus(userId, accountStatus, reason) {
  const response = await apiClient.patch(`/admin/users/${userId}/status`, {
    account_status: accountStatus,
    reason,
  });
  return response.data;
}

export async function updateAdminUserRole(userId, roleName, reason) {
  const response = await apiClient.patch(`/admin/users/${userId}/role`, {
    role_name: roleName,
    reason,
  });
  return response.data;
}
