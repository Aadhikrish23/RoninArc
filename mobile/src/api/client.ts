import Constants from "expo-constants";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { components } from "./schema";

export type Schemas = components["schemas"];
export type Game = Schemas["LibraryGameWithRating"];
export type Note = Schemas["Note"];
export type Review = Schemas["Review"];
export type Collection = Omit<Schemas["Collection"], "gameIds"> & { gameIds: (string | { _id: string; title?: string })[] };
export type RawgResult = Schemas["RawgSearchResult"];
export type Recommendation = Schemas["Recommendation"];
export type DashboardOverview = Schemas["DashboardOverview"];
export type ChatResponse = Schemas["AIChatResponse"];

/** RoninArc Cloud, set at build time (app.config.ts). */
export const CLOUD_URL: string = (Constants.expoConfig?.extra as { cloudUrl?: string } | undefined)?.cloudUrl ?? "";

/** The phone's encrypted store; the browser preview (no secure store there) uses localStorage. */
const store =
  Platform.OS === "web"
    ? {
        getItemAsync: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
        setItemAsync: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
        deleteItemAsync: async (k: string) => globalThis.localStorage?.removeItem(k),
      }
    : SecureStore;

const KEYS = { access: "roninarc.access", refresh: "roninarc.refresh", user: "roninarc.user" } as const;

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { name: string; email?: string | null };
}

export async function loadSession(): Promise<Session | null> {
  const [accessToken, refreshToken, user] = await Promise.all([
    store.getItemAsync(KEYS.access),
    store.getItemAsync(KEYS.refresh),
    store.getItemAsync(KEYS.user),
  ]);
  if (!accessToken || !refreshToken || !user) return null;
  try {
    return { accessToken, refreshToken, user: JSON.parse(user) };
  } catch {
    return null;
  }
}

export async function saveSession(s: Session) {
  await Promise.all([
    store.setItemAsync(KEYS.access, s.accessToken),
    store.setItemAsync(KEYS.refresh, s.refreshToken),
    store.setItemAsync(KEYS.user, JSON.stringify(s.user)),
  ]);
}

export async function clearSession() {
  await Promise.all(Object.values(KEYS).map((k) => store.deleteItemAsync(k)));
}

/** An error with the server's own words ("Invalid credentials", "Username is already taken"). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

let session: Session | null = null;
let onSignedOut: () => void = () => {};
let refreshing: Promise<boolean> | null = null;

export function setSession(s: Session | null) {
  session = s;
}
export function onSessionEnded(fn: () => void) {
  onSignedOut = fn;
}

async function refreshTokens(): Promise<boolean> {
  if (!session) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${CLOUD_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session!.refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()).Data as { accessToken: string; refreshToken: string };
      session = { ...session!, ...data };
      await saveSession(session);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

function messageFrom(body: any, status: number): string {
  if (typeof body?.error === "string") return body.error;
  if (typeof body?.Message === "string") return body.Message;
  if (typeof body?.message === "string") return body.message;
  if (status === 429) return "Too many tries. Wait a moment and try again.";
  return "Something went wrong. Try again.";
}

/**
 * A call to RoninArc Cloud: JSON in and out, the signed-in session attached, one silent token
 * refresh when it has expired. Unwraps `{ Status, Data }`.
 */
export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown; auth?: boolean; timeoutMs?: number } = {}): Promise<T> {
  const { method = "GET", body, auth = true, timeoutMs = 30_000 } = options;
  const send = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${CLOUD_URL}${path}`, {
        method,
        headers: {
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(auth && session ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e: any) {
      throw new ApiError(
        e?.name === "AbortError" ? "RoninArc took too long to answer. Try again." : "Can't reach RoninArc. Check your internet connection.",
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await send();
  if (res.status === 401 && auth && session) {
    if (await refreshTokens()) res = await send();
    else {
      onSignedOut();
      throw new ApiError("You've been signed out. Sign in again.", 401);
    }
  }
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status);
  return (data && typeof data === "object" && "Data" in (data as object) ? (data as { Data: T }).Data : data) as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
