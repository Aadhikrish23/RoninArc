import api from "../../../shared/api/axiosInstance";

export interface AutoLinkState {
  /** Waiting for internet; the PC retries every minute. */
  waiting: boolean;
  /** "name-taken": the name is someone else's in the cloud. */
  attention: "name-taken" | "failed" | null;
  message: string | null;
  /** Free cloud names to offer instead. */
  suggestions: string[];
}

export interface SyncStatus {
  /** This build can reach RoninArc Cloud. */
  available: boolean;
  linked: boolean;
  cloudUsername: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  needsSignIn: boolean;
  pending: { changes: number; deletes: number };
  /** Only after linking to an existing cloud account: this account's id changed, sign in afresh. */
  moved?: boolean;
  session?: { accessToken: string; refreshToken: string };
  /** A phone has signed in to this account. */
  phoneLinked?: boolean;
  /** "Sync with my other devices" was ticked but this PC isn't linked yet. */
  autoLink?: AutoLinkState | null;
  /** Only from autoLink(). */
  result?: "linked" | "waiting" | "needs-attention" | "unavailable";
}

const status = async () => (await api.get<SyncStatus>("sync/status")).data;
/** Creating with nothing given uses this PC's account, password included. */
const link = async (input: { mode: "create" | "signin"; username?: string; email?: string; password?: string }) =>
  (await api.post<SyncStatus>("sync/link", input, { timeout: 300_000 })).data;
const reconnect = async (password: string) => (await api.post<SyncStatus>("sync/reconnect", { password }, { timeout: 60_000 })).data;
const unlink = async () => (await api.post<SyncStatus>("sync/unlink")).data;
const syncNow = async () => (await api.post<SyncStatus>("sync/now", undefined, { timeout: 120_000 })).data;
const forgotPassword = async (identifier: string) =>
  (await api.post<{ Status: string; Message: string }>("auth/forgot-password", { identifier }, { timeout: 20_000 })).data;

/** "Sync with my other devices" at sign-in. Never fails the sign-in; see SyncStatus.result. */
const autoLink = async (password?: string) => (await api.post<SyncStatus>("sync/auto-link", { password }, { timeout: 300_000 })).data;
const dropAutoLink = async () => (await api.delete<SyncStatus>("sync/auto-link")).data;
/** Whether a name is free in RoninArc Cloud (for the sign-up form). */
const nameAvailable = async (username: string) =>
  (await api.get<{ available: boolean; suggestions: string[] }>("sync/name-available", { params: { username }, timeout: 20_000 })).data;
/** A 6-digit code (shown with a QR code) that signs a phone in to this PC's cloud account. */
const phoneCode = async () => (await api.post<{ code: string; expiresAt: string }>("sync/phone-code", undefined, { timeout: 120_000 })).data;

export default { status, link, reconnect, unlink, syncNow, forgotPassword, autoLink, dropAutoLink, nameAvailable, phoneCode };
