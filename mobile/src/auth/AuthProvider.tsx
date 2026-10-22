import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearSession, loadSession, onSessionEnded, saveSession, setSession, type Session } from "@/api/client";
import { queryClient } from "@/data/queryClient";

interface AuthState {
  ready: boolean;
  user: Session["user"] | null;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

type AuthPayload = { userdata: { name: string; email?: string }; accessToken: string; refreshToken: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Session["user"] | null>(null);

  const start = useCallback(async (payload: AuthPayload) => {
    const s: Session = { accessToken: payload.accessToken, refreshToken: payload.refreshToken, user: { name: payload.userdata.name, email: payload.userdata.email ?? null } };
    setSession(s);
    await saveSession(s);
    setUser(s.user);
  }, []);

  const end = useCallback(async () => {
    setSession(null);
    await clearSession();
    queryClient.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    onSessionEnded(() => void end());
    loadSession()
      .then((s) => {
        setSession(s);
        setUser(s?.user ?? null);
      })
      .finally(() => setReady(true));
  }, [end]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      signIn: async (username, password) => start(await api<AuthPayload>("/auth/login", { method: "POST", body: { username: username.trim(), password }, auth: false })),
      signUp: async (username, email, password) =>
        start(await api<AuthPayload>("/auth/register", { method: "POST", body: { username: username.trim(), email: email.trim(), password }, auth: false })),
      signOut: async () => {
        const s = await loadSession();
        if (s) await api("/auth/logout", { method: "POST", body: { refreshToken: s.refreshToken }, auth: false }).catch(() => {});
        await end();
      },
    }),
    [ready, user, start, end],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
