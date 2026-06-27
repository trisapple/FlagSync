import apiClient from "../api/axiosClient";
import { clearSessionUser } from "../utils/authSession";

export async function login(credentials) {
  const response = await apiClient.post("/auth/login", credentials);
  return response.data;
}

export async function register(accountDetails) {
  const response = await apiClient.post("/auth/register", accountDetails);
  return response.data;
}

export async function logout() {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    clearSessionUser();
  }
}

export async function getCurrentUser() {
  const response = await apiClient.get("/auth/me");
  return response.data;
}
