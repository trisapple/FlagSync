import apiClient from "../api/axiosClient";

export async function updateProfile(profileDetails) {
  const response = await apiClient.patch("/users/me", profileDetails);
  return response.data;
}

export async function changePassword(passwordDetails) {
  const response = await apiClient.patch("/users/me/password", passwordDetails);
  return response.data;
}
