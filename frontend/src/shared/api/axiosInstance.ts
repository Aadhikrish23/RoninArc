import axios from "axios";
import { API_BASE_URL } from "./config";
import { updateAuthTokens } from "../utils/tokenManager";

let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const sessionToken = sessionStorage.getItem("roninarc_token");

    const localToken = localStorage.getItem("roninarc_token");

    const token = sessionToken || localToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute = originalRequest.url?.includes("auth/");
    console.log("[AUTH]", originalRequest.url, isAuthRoute);
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      originalRequest._retry = true;

      try {
        const currentRefreshToken =
          localStorage.getItem("roninarc_refresh_token") ||
          sessionStorage.getItem("roninarc_refresh_token");

        if (!currentRefreshToken) {
          throw new Error("Refresh token missing");
        }

        if (!isRefreshing) {
          isRefreshing = true;

          console.log("[AUTH] Starting token refresh...");

          refreshPromise = axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken: currentRefreshToken,
          });
        }

        const refreshResponse = await refreshPromise;

        const { accessToken, refreshToken: newRefreshToken } =
          refreshResponse.data.Data;
        console.log("[AUTH] New Access Token:", accessToken);

        console.log(
          "[AUTH] LocalStorage Token BEFORE:",
          localStorage.getItem("roninarc_token"),
        );

        const usingLocalStorage = !!localStorage.getItem(
          "roninarc_refresh_token",
        );
        console.log("[AUTH] Using Local Storage:", usingLocalStorage);
        updateAuthTokens(accessToken, newRefreshToken);

        originalRequest.headers = originalRequest.headers || {};

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        console.log("[AUTH] Retrying:", originalRequest.url);

        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem("roninarc_user");
        localStorage.removeItem("roninarc_token");
        localStorage.removeItem("roninarc_refresh_token");

        sessionStorage.removeItem("roninarc_user");
        sessionStorage.removeItem("roninarc_token");
        sessionStorage.removeItem("roninarc_refresh_token");

        window.location.href = "/#/login";

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
