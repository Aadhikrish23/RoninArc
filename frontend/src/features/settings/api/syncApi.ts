import api from "../../../shared/api/axiosInstance";

export interface AutoLinkState {
  /** Waiting for internet; the PC retries every minute. */
  waiting: boolean;
  /**
   * "email-taken": the email already has a cloud account with a different password (enter it to
   * sync with it). "needs-email": this account has no email yet.
   */
  attention: "email-taken" | "needs-email" | "failed" | null;
  message: string | null;
}

export interface SyncStatus {
  /** This build can reach RoninArc Cloud. */
  available: boolean;
  linked: boolean;
  cloudUsername: string | null;
  /** The email this PC signs in to the cloud with ("Syncing as ..."). */
  cloudEmail?: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  needsSignIn: boolean;
  pending: { changes: number; deletes: number };
  /** Only after linking to an existing cloud account: this account's id changed, sign in afresh. */
  moved?: boolean;
  session?: { accessToken: string; refreshToken: string; userdata?: { name: string; displayName?: string; email: string | null } };
  /** A phone has signed in to this account. */
  phoneLinked?: boolean;
  /** "Sync with my other devices" was ticked but this PC isn't linked yet. */
  autoLink?: AutoLinkState | null;
  /** Only from autoLink(). */
  result?: "linked" | "waiting" | "needs-attention" | "unavailable";
}

const status = async () => (await api.get<SyncStatus>("sync/status")).data;
/** Creating with nothing given uses this PC's account, password included. */
const link = async (input: { mode: "create" | "signin"; email?: string; password?: string }) =>
  (await api.post<SyncStatus>("sync/link", input, { timeout: 300_000 })).data;
const reconnect = async (password: string) => (await api.post<SyncStatus>("sync/reconnect", { password }, { timeout: 60_000 })).data;
const unlink = async () => (await api.post<SyncStatus>("sync/unlink")).data;
const syncNow = async () => (await api.post<SyncStatus>("sync/now", undefined, { timeout: 120_000 })).data;
const forgotPassword = async (identifier: string) =>
  (await api.post<{ Status: string; Message: string }>("auth/forgot-password", { identifier }, { timeout: 20_000 })).data;

/** "Sync with my other devices" at sign-in. Never fails the sign-in; see SyncStatus.result. */
const autoLink = async (password?: string) => (await api.post<SyncStatus>("sync/auto-link", { password }, { timeout: 300_000 })).data;
const dropAutoLink = async () => (await api.delete<SyncStatus>("sync/auto-link")).data;
/** A 6-digit code (shown with a QR code) that signs a phone in to this PC's cloud account. */
const phoneCode = async () => (await api.post<{ code: string; expiresAt: string }>("sync/phone-code", undefined, { timeout: 120_000 })).data;

export default { status, link, reconnect, unlink, syncNow, forgotPassword, autoLink, dropAutoLink, phoneCode };
