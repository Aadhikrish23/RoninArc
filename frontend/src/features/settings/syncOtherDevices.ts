import type { UseToastOptions } from "@chakra-ui/react";
import syncApi, { type SyncStatus } from "./api/syncApi";
import type { AuthUser } from "../auth/context/AuthContext";

/**
 * "Sync with my other devices" next to "Remember me". Ticked unless the person turned syncing off
 * on this PC before ("Stop syncing", or "Not now" on the notice): then it starts unticked.
 */
const PREF = "roninarc.syncOtherDevices";
const NOTICE = "roninarc.syncAttentionNoticeShown";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode: just not remembered */
  }
};

export const syncPreference = () => read(PREF) !== "false";
export const setSyncPreference = (on: boolean) => write(PREF, on ? null : "false");

/** "Needs attention" is told once as a notice; Settings keeps showing it after that. */
export const attentionNoticeShown = () => read(NOTICE) === "1";
export const markAttentionNoticeShown = () => write(NOTICE, "1");

type Toast = (options: UseToastOptions) => unknown;
type Login = (user: AuthUser, accessToken: string, refreshToken: string, rememberMe?: boolean) => void;

/**
 * Right after a sign-in or sign-up with the box ticked: the same as pressing "Sync to cloud",
 * in the background. Never blocks or fails the sign-in. The password only tries the cloud
 * account of the same name (it's often the same person, signed up on the phone first).
 */
export async function syncWithOtherDevices(opts: { password: string; rememberMe: boolean; email?: string; login: Login; toast: Toast }): Promise<SyncStatus | undefined> {
  let status: SyncStatus;
  try {
    const now = await syncApi.status();
    if (!now.available || now.linked) return now;
    status = await syncApi.autoLink(opts.password);
  } catch {
    // The PC's own server didn't answer: nothing to do now; Settings still offers it.
    return undefined;
  }

  if (status.moved && status.session) {
    // Linked to the same person's existing cloud account: its id is this account's now.
    opts.login({ name: status.cloudUsername ?? "", email: opts.email }, status.session.accessToken, status.session.refreshToken, opts.rememberMe);
  }
  if (status.result === "linked") {
    opts.toast({ title: "Syncing with your other devices", description: "Sign in to RoninArc on your phone with the same account, or use Connect your phone in Settings.", status: "success", duration: 6000, isClosable: true });
  } else if (status.result === "waiting") {
    opts.toast({ title: "Sync turns on when you're online", description: "Everything works here meanwhile.", status: "info", duration: 6000, isClosable: true });
  } else if (status.result === "needs-attention" && !attentionNoticeShown()) {
    markAttentionNoticeShown();
    opts.toast({
      title: "Sync needs your attention",
      description:
        status.autoLink?.attention === "name-taken"
          ? "Someone else already uses this name in RoninArc Cloud. Choose a name for syncing in Settings → RoninArc Cloud."
          : `${status.autoLink?.message ?? "Couldn't turn on sync."} See Settings → RoninArc Cloud.`,
      status: "warning",
      duration: 10000,
      isClosable: true,
    });
  }
  return status;
}
