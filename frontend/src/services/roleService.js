import apiClient from "../api/axiosClient";

export async function getAllRoles() {
  const response = await apiClient.get("/roles");
  return response.data;
}