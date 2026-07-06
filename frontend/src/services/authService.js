import apiClient from "../api/axiosClient";
import { clearSessionUser } from "../utils/authSession";

const AUTH_BASE_PATH = "/auth";

export async function login(credentials) {
  const response = await apiClient.post(`${AUTH_BASE_PATH}/login`, credentials);
  return response.data;
}

export async function verifyLoginOtp({ loginIntentId, otp }) {
  const response = await apiClient.post(`${AUTH_BASE_PATH}/login/verify-otp`, {
    login_intent_id: loginIntentId,
    otp,
  });
  return response.data;
}

export async function resendLoginOtp(loginIntentId) {
  const response = await apiClient.post(`${AUTH_BASE_PATH}/login/resend-otp`, {
    login_intent_id: loginIntentId,
  });
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

export async function verifyEmail(token) {
  const response = await apiClient.post(`${AUTH_BASE_PATH}/verify-email`, {
    token,
  });
  return response.data;
}

export async function resendVerification(email) {
  const response = await apiClient.post(`${AUTH_BASE_PATH}/resend-verification`, {
    email,
  });
  return response.data;
}

export async function requestPasswordReset(email) {
  const response = await apiClient.post(
    `${AUTH_BASE_PATH}/password-reset/request`,
    { email },
  );
  return response.data;
}

export async function confirmPasswordReset({ token, newPassword }) {
  const response = await apiClient.post(
    `${AUTH_BASE_PATH}/password-reset/confirm`,
    { token, new_password: newPassword },
  );
  return response.data;
}
