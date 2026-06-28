import apiClient from "../api/axiosClient";
import { clearSessionUser } from "../utils/authSession";

const AUTH_BASE_PATH = "/auth";

export async function login(credentials) {
  const response = await apiClient.post(`${AUTH_BASE_PATH}/login`, credentials);
  return response.data;
}

export async function getRegistrationChallenge() {
  const response = await apiClient.get(`${AUTH_BASE_PATH}/register/challenge`);
  return response.data;
}

export async function register(accountDetails) {
  const response = await apiClient.post(
    `${AUTH_BASE_PATH}/register`,
    accountDetails,
  );
  return response.data;
}

export async function logout() {
  try {
    await apiClient.post(`${AUTH_BASE_PATH}/logout`);
  } finally {
    clearSessionUser();
  }
}

export async function getCurrentUser() {
  const response = await apiClient.get(`${AUTH_BASE_PATH}/me`);
  return response.data;
}

export async function updateCurrentUser(profileChanges) {
  const response = await apiClient.patch(`${AUTH_BASE_PATH}/me`, profileChanges);
  clearSessionUser();
  return response.data;
}

export async function deleteCurrentUser() {
  const response = await apiClient.delete(`${AUTH_BASE_PATH}/me`);
  clearSessionUser();
  return response.data;
}
