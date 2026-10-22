import api from "../../../shared/api/axiosInstance";

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
}

const status = async () => (await api.get<SyncStatus>("sync/status")).data;
const link = async (input: { mode: "create" | "signin"; username: string; email?: string; password: string }) =>
  (await api.post<SyncStatus>("sync/link", input, { timeout: 120_000 })).data;
const reconnect = async (password: string) => (await api.post<SyncStatus>("sync/reconnect", { password }, { timeout: 60_000 })).data;
const unlink = async () => (await api.post<SyncStatus>("sync/unlink")).data;
const syncNow = async () => (await api.post<SyncStatus>("sync/now", undefined, { timeout: 120_000 })).data;
const forgotPassword = async (identifier: string) =>
  (await api.post<{ Status: string; Message: string }>("auth/forgot-password", { identifier }, { timeout: 20_000 })).data;

export default { status, link, reconnect, unlink, syncNow, forgotPassword };
