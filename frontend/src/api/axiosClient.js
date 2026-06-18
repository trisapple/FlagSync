import axios from "axios";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,

  // Required when FastAPI stores authentication in an HttpOnly cookie.
  withCredentials: true,

  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ??
      "The request could not be completed. Please try again.";

    return Promise.reject(new Error(message));
  },
);

export default apiClient;