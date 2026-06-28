import apiClient from "../api/axiosClient";

export async function login(credentials) {
  const response = await apiClient.post("/auth/login", credentials);
  return response.data;
}

export async function getRegistrationChallenge() {
  const response = await apiClient.get("/auth/register/challenge");
  return response.data;
}

export async function register(accountDetails) {
  const response = await apiClient.post("/auth/register", accountDetails);
  return response.data;
}

export async function logout() {
  await apiClient.post("/auth/logout");
}

export async function getCurrentUser() {
  const response = await apiClient.get("/auth/me");
  return response.data;
}

export async function updateCurrentUser(profileChanges) {
  const response = await apiClient.patch("/auth/me", profileChanges);
  return response.data;
}

export async function deleteCurrentUser() {
  const response = await apiClient.delete("/auth/me");
  return response.data;
}
