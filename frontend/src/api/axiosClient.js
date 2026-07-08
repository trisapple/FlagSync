import axios from "axios";
import { notifySessionExpired } from "../utils/authSession";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,

  // Required when FastAPI stores authentication in an HttpOnly cookie.
  withCredentials: true,

  headers: {
    "Content-Type": "application/json",
  },
});

// Login/OTP endpoints return their own 401s for wrong credentials/codes —
// those must never be mistaken for an expired session on a protected route.
const AUTH_FLOW_PATHS = [
  "/auth/login",
  "/auth/login/verify-otp",
  "/auth/login/resend-otp",
];

function isAuthFlowRequest(url) {
  if (!url) return false;
  return AUTH_FLOW_PATHS.some((path) => url.includes(path));
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg ?? String(d)).join(", ")
          : "The request could not be completed. Please try again.";

    if (
      error.response?.status === 401 &&
      !isAuthFlowRequest(error.config?.url)
    ) {
      notifySessionExpired();
    }

    return Promise.reject(new Error(message));
  },
);

export default apiClient;