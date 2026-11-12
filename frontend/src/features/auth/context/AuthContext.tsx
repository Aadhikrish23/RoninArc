import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import authApi from "../api/authApi";
import { setTokenUpdater } from "../../../shared/utils/tokenManager";
import { clearSession, clearStore, signedInStore } from "../../../shared/utils/sessionStore";

export interface AuthUser {
  /** The display name (shown in the app; not unique). */
  name: string;
  /** How the account signs in. Missing only on PC accounts from before email sign-in. */
  email?: string | null;
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
  /** The signed-in person's name or email changed (e.g. an email was added). */
  updateUser: (changes: Partial<AuthUser>) => void;

  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  useEffect(() => {
    // One store holds the session: all three values come from it, never a mix of the two.
    const store = signedInStore();
    const storedUser = store?.getItem("roninarc_user");
    const storedToken = store?.getItem("roninarc_token");
    const storedRefreshToken = store?.getItem("roninarc_refresh_token");

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

    // The other store may hold an older sign-in; leaving it would bring that one back later.
    clearStore(rememberMe ? sessionStorage : localStorage);

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
      const refreshToken = signedInStore()?.getItem("roninarc_refresh_token");

      if (refreshToken) {
        await authApi.logoutUser(refreshToken);
      }
    } catch (error) {
      console.error(error);
    } finally {
      clearSession();

      setUser(null);
      setToken(null);
      setRefreshToken(null);
    }
  };
  const updateUser = (changes: Partial<AuthUser>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...changes };
      const store = localStorage.getItem("roninarc_user") ? localStorage : sessionStorage;
      store.setItem("roninarc_user", JSON.stringify(next));
      return next;
    });
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
        updateUser,
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
