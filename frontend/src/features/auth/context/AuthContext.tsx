import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import authApi from "../api/authApi";
import { setTokenUpdater } from "../../../shared/utils/tokenManager";

export interface AuthUser {
  name: string;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (
    user: AuthUser,
    accessToken: string,
    refreshToken: string,
    rememberMe?: boolean,
  ) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;

  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    const storedUser =
      localStorage.getItem("roninarc_user") ||
      sessionStorage.getItem("roninarc_user");

    const storedToken =
      localStorage.getItem("roninarc_token") ||
      sessionStorage.getItem("roninarc_token");

    const storedRefreshToken =
      localStorage.getItem("roninarc_refresh_token") ||
      sessionStorage.getItem("roninarc_refresh_token");

    if (storedUser && storedToken && storedRefreshToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
      setRefreshToken(storedRefreshToken);
    }

    setIsLoading(false);
  }, []);

  const login = (
    userData: AuthUser,
    accessToken: string,
    refreshTokenValue: string,
    rememberMe = false,
  ) => {
    setUser(userData);
    setToken(accessToken);
    setRefreshToken(refreshTokenValue);

    if (rememberMe) {
      localStorage.setItem("roninarc_user", JSON.stringify(userData));

      localStorage.setItem("roninarc_token", accessToken);

      localStorage.setItem("roninarc_refresh_token", refreshTokenValue);
    } else {
      sessionStorage.setItem("roninarc_user", JSON.stringify(userData));

      sessionStorage.setItem("roninarc_token", accessToken);

      sessionStorage.setItem("roninarc_refresh_token", refreshTokenValue);
    }
  };

  const logout = async () => {
    try {
      const refreshToken =
        localStorage.getItem("roninarc_refresh_token") ||
        sessionStorage.getItem("roninarc_refresh_token");

      if (refreshToken) {
        await authApi.logoutUser(refreshToken);
      }
    } catch (error) {
      console.error(error);
    } finally {
      clearStorage();

      setUser(null);
      setToken(null);
      setRefreshToken(null);
    }
  };
  const updateTokens = (accessToken: string, refreshTokenValue: string) => {
    setToken(accessToken);
    setRefreshToken(refreshTokenValue);

    const usingLocalStorage = !!localStorage.getItem("roninarc_refresh_token");

    if (usingLocalStorage) {
      localStorage.setItem("roninarc_token", accessToken);

      localStorage.setItem("roninarc_refresh_token", refreshTokenValue);
    } else {
      sessionStorage.setItem("roninarc_token", accessToken);

      sessionStorage.setItem("roninarc_refresh_token", refreshTokenValue);
    }
  };
  useEffect(() => {
    setTokenUpdater(updateTokens);

    return () => {
      setTokenUpdater(() => {});
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        isAuthenticated: !!token,
        isLoading,
        login,
        updateTokens,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
function clearStorage() {
  localStorage.removeItem("roninarc_user");
  localStorage.removeItem("roninarc_token");
  localStorage.removeItem("roninarc_refresh_token");

  sessionStorage.removeItem("roninarc_user");
  sessionStorage.removeItem("roninarc_token");
  sessionStorage.removeItem("roninarc_refresh_token");
}
