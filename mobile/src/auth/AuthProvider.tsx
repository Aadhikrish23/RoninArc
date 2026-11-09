import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearSession, loadSession, onSessionEnded, saveSession, setSession, wakeCloud, type Session } from "@/api/client";
import { queryClient } from "@/data/queryClient";

interface AuthState {
  ready: boolean;
  user: Session["user"] | null;
  /** `onWaking`: the cloud is waking up (up to a minute), so the screen can say so. */
  signIn: (email: string, password: string, onWaking?: () => void) => Promise<void>;
  /** `name` is only shown in the app; you sign in with the email. */
  signUp: (name: string, email: string, password: string, onWaking?: () => void) => Promise<void>;
  /** The 6-digit code (or scanned QR) from RoninArc on the PC: signs in to that account, no password. */
  signInWithCode: (code: string, onWaking?: () => void) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

type AuthPayload = { userdata: { name: string; displayName?: string; email?: string | null }; accessToken: string; refreshToken: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Session["user"] | null>(null);

  const start = useCallback(async (payload: AuthPayload, via: "code" | "password" = "password") => {
    const s: Session = { accessToken: payload.accessToken, refreshToken: payload.refreshToken, user: { name: payload.userdata.name, email: payload.userdata.email ?? null, via } };
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
      signIn: async (email, password, onWaking) => {
        await wakeCloud(onWaking);
        await start(await api<AuthPayload>("/auth/login", { method: "POST", body: { email: email.trim(), password }, auth: false, timeoutMs: 45_000, retry: 1 }));
      },
      signUp: async (name, email, password, onWaking) => {
        await wakeCloud(onWaking);
        await start(await api<AuthPayload>("/auth/register", { method: "POST", body: { displayName: name.trim(), email: email.trim(), password }, auth: false, timeoutMs: 45_000, retry: 1 }));
      },
      signInWithCode: async (code, onWaking) => {
        await wakeCloud(onWaking);
        const payload = await api<AuthPayload>("/sync/link-code/claim", { method: "POST", body: { code }, auth: false, timeoutMs: 45_000 });
        // Maybe another account was signed in (an empty one): nothing of it may show under the new one.
        queryClient.clear();
        await start(payload, "code");
      },
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
