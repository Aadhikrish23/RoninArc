import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  name: string;
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: AuthUser, token: string, rememberMe?: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser =
      localStorage.getItem("roninarc_user") ||
      sessionStorage.getItem("roninarc_user");

    const storedToken =
      localStorage.getItem("roninarc_token") ||
      sessionStorage.getItem("roninarc_token");

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }

    setIsLoading(false);
  }, []);

  const login = (userData: AuthUser, jwtToken: string, rememberMe = false) => {
    setUser(userData);
    setToken(jwtToken);

    if (rememberMe) {
      localStorage.setItem("roninarc_user", JSON.stringify(userData));
      localStorage.setItem("roninarc_token", jwtToken);
    } else {
      sessionStorage.setItem("roninarc_user", JSON.stringify(userData));
      sessionStorage.setItem("roninarc_token", jwtToken);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);

    localStorage.removeItem("roninarc_user");
    localStorage.removeItem("roninarc_token");

    sessionStorage.removeItem("roninarc_user");
    sessionStorage.removeItem("roninarc_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
         isLoading,
        login,
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
