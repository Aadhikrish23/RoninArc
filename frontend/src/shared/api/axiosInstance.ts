import axios from "axios";
import { API_BASE_URL } from "./config";
import { updateAuthTokens } from "../utils/tokenManager";
import { log } from "../logging/clientLogger";
import { clearSession, signedInStore } from "../utils/sessionStore";

const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());

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
    const token = signedInStore()?.getItem("roninarc_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Lets a client-side error be matched to the backend's log line for the same call.
    config.headers["X-Request-Id"] = newRequestId();

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute = originalRequest.url?.includes("auth/");
    const status = error.response?.status;
    if (!error.response || status >= 500) {
      const call = `${originalRequest?.method?.toUpperCase()} ${originalRequest?.url}`;
      log(status ? "error" : "warn", status ? `API ${status} on ${call}` : `Network error on ${call}`, {
        requestId: originalRequest?.headers?.["X-Request-Id"],
        context: { status, message: error.response?.data?.error ?? error.message },
      });
    }
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      originalRequest._retry = true;

      try {
        const currentRefreshToken = signedInStore()?.getItem("roninarc_refresh_token");

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
        clearSession();

        // The hash only: "/#/login" resolves to file:///#/login in the installed app, a blank page.
        window.location.hash = "#/login";

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
