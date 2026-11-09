import axios, { type AxiosInstance } from "axios";
import mongoose from "mongoose";
import AppError from "../../shared/errors/AppError";
import { cloudApiUrl, isCloud } from "../../shared/runtimeMode";
import { moduleLogger } from "../../shared/logging/logger";
import usermodel from "../auth/models/User";
import RefreshToken from "../auth/models/RefreshToken";
import EpicOwnership from "../providers/epic/models/EpicOwnership";
import { SyncIntent, SyncLink, Tombstone } from "./syncModels";
import { CLOUD_META, SYNCED, changedAt, forWire, syncedByName, type SyncedCollection } from "./syncCollections";
import { naturalFilters } from "./syncKeys";

const { EJSON } = mongoose.mongo.BSON;
const log = moduleLogger("sync");

const PUSH_BATCH = 1000;
const SYNC_EVERY_MS = 60_000;
const AFTER_CHANGE_MS = 4_000;
const HTTP_TIMEOUT_MS = 20_000;
const CLOUD_WAKE_TIMEOUT_MS = 90_000;

/* ------------------------------------------------------------------ */
/* Talking to the cloud                                                 */
/* ------------------------------------------------------------------ */

function http(timeout = HTTP_TIMEOUT_MS): AxiosInstance {
  const base = cloudApiUrl();
  if (!base) throw new AppError("RoninArc Cloud isn't set up in this build.", 503);
  return axios.create({ baseURL: base, timeout });
}

/** A cloud error, in words for the person at the PC. */
function cloudError(error: any, fallback: string): AppError {
  if (error instanceof AppError) return error;
  const status = error?.response?.status;
  const body = error?.response?.data;
  const message = typeof body?.error === "string" ? body.error : body?.message || body?.error?.message;
  if (!status) return new AppError("Couldn't reach RoninArc Cloud. Check your internet connection and try again.", 503);
  return new AppError(message || fallback, status >= 500 ? 502 : status);
}

/** A cloud call with this PC's session, refreshing it once when it has expired. */
async function withCloud<T>(link: any, call: (api: AxiosInstance) => Promise<T>): Promise<T> {
  const api = http();
  api.defaults.headers.common.Authorization = `Bearer ${link.accessToken}`;
  try {
    return await call(api);
  } catch (error: any) {
    if (error?.response?.status !== 401) throw error;
    try {
      const { data } = await http().post("/auth/refresh", { refreshToken: link.refreshToken });
      link.accessToken = data.accessToken ?? data.Data?.accessToken;
      link.refreshToken = data.refreshToken ?? data.Data?.refreshToken;
      await SyncLink.updateOne({ _id: link._id }, { $set: { accessToken: link.accessToken, refreshToken: link.refreshToken } });
    } catch (refreshError: any) {
      if (refreshError?.response?.status === 401 || refreshError?.response?.status === 404) {
        await SyncLink.updateOne({ _id: link._id }, { $set: { needsSignIn: true, lastError: "Sign in to RoninArc Cloud again to keep syncing." } });
        throw new AppError("Sign in to RoninArc Cloud again to keep syncing.", 401);
      }
      throw refreshError;
    }
    api.defaults.headers.common.Authorization = `Bearer ${link.accessToken}`;
    return call(api);
  }
}

const tokensFrom = (data: any) => ({
  accessToken: data?.accessToken ?? data?.Data?.accessToken,
  refreshToken: data?.refreshToken ?? data?.Data?.refreshToken,
});

/* ------------------------------------------------------------------ */
/* Applying the cloud's changes here                                    */
/* ------------------------------------------------------------------ */

const isDirty = (doc: any) => !doc?._syncedUpdatedAt || +new Date(doc._syncedUpdatedAt) !== +new Date(doc.updatedAt);

function naturalFilter(coll: SyncedCollection, doc: any) {
  const $or = naturalFilters(coll, doc);
  return $or.length > 0 ? { userId: doc.userId, _id: { $ne: doc._id }, $or } : undefined;
}

/** Points everything here that referenced `from` at `to` (an id merged away in the cloud). */
async function rewriteLocalRefs(collName: string, from: any, to: any) {
  for (const c of SYNCED) {
    for (const ref of c.refs ?? []) {
      if (ref.coll !== collName) continue;
      if (ref.array) {
        await c.model.collection.updateMany({ [ref.field]: from }, { $set: { [`${ref.field}.$[x]`]: to } }, { arrayFilters: [{ x: from }] });
        // The same game twice in a list after the merge: keep one.
        const dupes = await c.model.collection.find({ [ref.field]: to }).toArray();
        for (const d of dupes) {
          const seen = new Set<string>();
          const unique = (d[ref.field] as any[]).filter((id) => (seen.has(String(id)) ? false : (seen.add(String(id)), true)));
          if (unique.length !== d[ref.field].length) await c.model.collection.updateOne({ _id: d._id }, { $set: { [ref.field]: unique } });
        }
      } else {
        await c.model.collection.updateMany({ [ref.field]: from }, { $set: { [ref.field]: to } });
      }
    }
  }
}

/** One document from the cloud. A newer edit made here wins and goes up on the next push. */
async function applyRemote(coll: SyncedCollection, wire: any) {
  const remote = EJSON.deserialize(wire);
  const effective = changedAt(remote);
  for (const f of CLOUD_META) delete remote[f];
  const raw = coll.model.collection;
  const local: any = await raw.findOne({ _id: remote._id });
  if (local && isDirty(local) && new Date(local.updatedAt) > effective) return;

  const next: any = { ...remote, updatedAt: effective, _syncedUpdatedAt: effective };
  for (const f of coll.localOnly ?? []) if (local && local[f] !== undefined) next[f] = local[f];

  try {
    await raw.replaceOne({ _id: next._id }, next, { upsert: true });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    // The same thing exists here under another id (made here offline, not pushed yet).
    const filter = naturalFilter(coll, next);
    const twin: any = filter ? await raw.findOne(filter) : null;
    if (!twin) throw error;
    if (isDirty(twin) && new Date(twin.updatedAt) > effective) return; // the push will merge it
    const merged = coll.merge ? coll.merge(next, twin) : next;
    await raw.deleteOne({ _id: twin._id });
    await rewriteLocalRefs(coll.name, twin._id, next._id);
    await raw.replaceOne({ _id: next._id }, merged, { upsert: true });
  }
}

async function applyRemoteDelete(del: { coll: string; id: string; deletedAt: string }) {
  const coll = syncedByName.get(del.coll);
  if (!coll || !mongoose.isValidObjectId(del.id)) return;
  const _id = new mongoose.Types.ObjectId(del.id);
  const local: any = await coll.model.collection.findOne({ _id });
  if (!local) return;
  if (isDirty(local) && new Date(local.updatedAt) > new Date(del.deletedAt)) return; // edited here after: keep it
  // The raw collection: no tombstone, so this delete isn't pushed back.
  await coll.model.collection.deleteOne({ _id });
}

/** The cloud account's name, email and password hash, so this PC signs in offline with the cloud password. */
async function applyProfile(user: any) {
  if (!user?.id || !mongoose.isValidObjectId(user.id)) return;
  const set: any = { passwordHash: user.passwordHash, email: user.email ?? undefined };
  if (user.displayName) set.displayName = user.displayName;
  if (user.username) {
    const taken = await usermodel.collection.findOne({ username: user.username, _id: { $ne: new mongoose.Types.ObjectId(user.id) } });
    if (!taken) set.username = user.username;
  }
  await usermodel.collection.updateOne({ _id: new mongoose.Types.ObjectId(user.id) }, { $set: set });
  if (user.phoneLinkedAt) {
    await SyncLink.updateOne({ userId: new mongoose.Types.ObjectId(user.id), phoneLinkedAt: null }, { $set: { phoneLinkedAt: new Date(user.phoneLinkedAt) } });
  }
}

async function applyPull(data: any) {
  for (const coll of SYNCED) for (const doc of data.changes?.[coll.name] ?? []) await applyRemote(coll, doc);
  for (const del of data.deletes ?? []) await applyRemoteDelete(del);
  if (data.user) await applyProfile(data.user);
}

/* ------------------------------------------------------------------ */
/* One sync round: push what changed here, then pull what changed there */
/* ------------------------------------------------------------------ */

async function pendingCounts(userId: mongoose.Types.ObjectId) {
  let changes = 0;
  for (const coll of SYNCED) {
    changes += await coll.model.collection.countDocuments({ userId, $expr: { $ne: ["$updatedAt", { $ifNull: ["$_syncedUpdatedAt", null] }] } });
  }
  const deletes = await Tombstone.countDocuments({ userId, pushed: false });
  return { changes, deletes };
}

async function pushOnce(link: any, userId: mongoose.Types.ObjectId): Promise<boolean> {
  const changes: Record<string, any[]> = {};
  const sent: Record<string, { _id: any; updatedAt: Date }[]> = {};
  let count = 0;
  for (const coll of SYNCED) {
    if (count >= PUSH_BATCH) break;
    const docs = await coll.model.collection
      .find({ userId, $expr: { $ne: ["$updatedAt", { $ifNull: ["$_syncedUpdatedAt", null] }] } })
      .limit(PUSH_BATCH - count)
      .toArray();
    if (!docs.length) continue;
    changes[coll.name] = docs.map((d) => EJSON.serialize(forWire(coll, d)));
    sent[coll.name] = docs.map((d) => ({ _id: d._id, updatedAt: d.updatedAt }));
    count += docs.length;
  }
  const tombstones = count < PUSH_BATCH ? await Tombstone.find({ userId, pushed: false }).limit(PUSH_BATCH - count).lean() : [];
  if (count === 0 && tombstones.length === 0) return false;

  const deletes = tombstones.map((t) => ({ coll: t.coll, id: String(t.docId), deletedAt: (t.deletedAt as Date).toISOString() }));
  const result: any = await withCloud(link, async (api) => (await api.post("/sync/push", { changes, deletes })).data);

  for (const r of result.remapped ?? []) {
    const coll = syncedByName.get(r.coll);
    if (!coll || !mongoose.isValidObjectId(r.from) || !mongoose.isValidObjectId(r.to)) continue;
    const from = new mongoose.Types.ObjectId(r.from);
    const to = new mongoose.Types.ObjectId(r.to);
    await rewriteLocalRefs(r.coll, from, to);
    // The cloud's copy arrives on the pull; this one merged into it.
    await coll.model.collection.deleteOne({ _id: from });
  }
  for (const [name, list] of Object.entries(sent)) {
    const coll = syncedByName.get(name)!;
    // Synced at the version sent; edited again meanwhile means it goes up next round.
    await Promise.all(list.map((d) => coll.model.collection.updateOne({ _id: d._id, updatedAt: d.updatedAt }, { $set: { _syncedUpdatedAt: d.updatedAt } })));
  }
  for (const [name, docs] of Object.entries(result.rejected ?? {})) {
    const coll = syncedByName.get(name);
    if (coll) for (const doc of docs as any[]) await applyRemote(coll, doc);
  }
  if (tombstones.length) await Tombstone.updateMany({ _id: { $in: tombstones.map((t) => t._id) } }, { $set: { pushed: true } });
  return count + tombstones.length >= PUSH_BATCH;
}

const running = new Map<string, Promise<void>>();

/**
 * Push, then pull. Never two at once for one user: a request during a round waits for it and
 * then runs its own (the running one may have started before the latest change). Failures are
 * recorded on the link, not thrown.
 */
export function syncNow(userIdRaw: string): Promise<void> {
  const key = String(userIdRaw);
  const task = (running.get(key) ?? Promise.resolve()).then(() => syncRound(key));
  running.set(key, task);
  void task.finally(() => {
    if (running.get(key) === task) running.delete(key);
  });
  return task;
}

function syncRound(key: string): Promise<void> {
  return (async () => {
    const userId = new mongoose.Types.ObjectId(key);
    const link: any = await SyncLink.findOne({ userId }).lean();
    if (!link || link.needsSignIn) return;
    try {
      for (let i = 0; i < 50 && (await pushOnce(link, userId)); i++);
      let cursor = link.cursor ? new Date(link.cursor).toISOString() : undefined;
      for (let i = 0; i < 50; i++) {
        const data: any = await withCloud(link, async (api) => (await api.get("/sync/pull", { params: cursor ? { since: cursor } : {} })).data);
        await applyPull(data);
        cursor = data.cursor;
        if (!data.hasMore) break;
      }
      await SyncLink.updateOne({ _id: link._id }, { $set: { cursor: cursor ? new Date(cursor) : null, lastSyncAt: new Date(), lastError: null } });
    } catch (error: any) {
      const message = cloudError(error, "Sync failed.").message;
      log.warn({ err: error?.message ?? String(error) }, "sync round failed");
      await SyncLink.updateOne({ _id: link._id }, { $set: { lastError: message } });
    }
  })();
}

const pendingTimers = new Map<string, NodeJS.Timeout>();

/** After a change here: sync a few seconds later (several quick changes go up together). */
export function syncSoon(userId: string) {
  if (isCloud() || !cloudApiUrl()) return;
  clearTimeout(pendingTimers.get(userId));
  pendingTimers.set(
    userId,
    setTimeout(() => {
      pendingTimers.delete(userId);
      void SyncLink.exists({ userId }).then((linked) => (linked ? syncNow(userId) : undefined));
    }, AFTER_CHANGE_MS),
  );
}

let scheduler: NodeJS.Timeout | undefined;

/** Every minute, sync every linked account on this PC (picks up phone changes, retries offline). */
export function startSyncScheduler() {
  if (isCloud() || !cloudApiUrl() || scheduler) return;
  const tick = async () => {
    const links = await SyncLink.find({ needsSignIn: false }).select("userId").lean();
    for (const l of links) await syncNow(String(l.userId));
    // "Sync with my other devices" ticked while offline: try again now.
    const waiting = await SyncIntent.find({ attention: null }).select("userId").lean();
    for (const w of waiting) await autoLink(String(w.userId)).catch(() => undefined);
  };
  setTimeout(() => void tick().catch(() => {}), 5_000);
  scheduler = setInterval(() => void tick().catch(() => {}), SYNC_EVERY_MS);
}

/* ------------------------------------------------------------------ */
/* Linking this PC's account to the cloud                               */
/* ------------------------------------------------------------------ */

export async function status(userIdRaw: string) {
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  const link: any = await SyncLink.findOne({ userId }).lean();
  const intent: any = link ? null : await SyncIntent.findOne({ userId }).lean();
  return {
    available: !!cloudApiUrl(),
    linked: !!link,
    cloudUsername: link?.cloudUsername ?? null,
    /** What this PC signs in to the cloud with ("Syncing as ..."). */
    cloudEmail: link ? link.cloudEmail ?? (await usermodel.collection.findOne({ _id: userId }))?.email ?? null : null,
    lastSyncAt: link?.lastSyncAt ?? null,
    lastError: link?.lastError ?? null,
    needsSignIn: !!link?.needsSignIn,
    pending: link ? await pendingCounts(userId) : { changes: 0, deletes: 0 },
    /** A phone has signed in to this account (so no "get your library on your phone"). */
    phoneLinked: !!link?.phoneLinkedAt,
    /** "Sync with my other devices" was ticked but isn't linked yet: waiting for internet, or for the person. */
    autoLink: intent
      ? { waiting: !intent.attention, attention: intent.attention ?? null, message: intent.message ?? null }
      : null,
  };
}

/** A code (and QR) a phone uses to sign in to this PC's cloud account, no password needed. */
export async function phoneCode(userIdRaw: string): Promise<{ code: string; expiresAt: string }> {
  const link: any = await SyncLink.findOne({ userId: new mongoose.Types.ObjectId(userIdRaw) }).lean();
  if (!link) throw new AppError("Sync this PC with RoninArc Cloud first.", 409);
  if (link.needsSignIn) throw new AppError("Sign in to RoninArc Cloud again first (Settings → RoninArc Cloud).", 409);
  try {
    return await withCloud(link, async (api) => (await api.post("/sync/link-code")).data);
  } catch (error) {
    throw cloudError(error, "Couldn't make a code for your phone.");
  }
}

const isTaken = (error: any) => error instanceof AppError && error.statusCode === 409;
// No answer, or the cloud still waking up (its host answers 502/503 meanwhile).
const isOffline = (error: any) => error instanceof AppError && (error.statusCode === 503 || error.statusCode === 502);

export const EMAIL_TAKEN_MESSAGE = "That email already has a RoninArc Cloud account. Enter its password to sync with it.";
export const NEEDS_EMAIL_MESSAGE = "Add your email to turn on sync.";

/**
 * "Sync with my other devices", ticked at sign-in. Links this account as if "Sync to cloud" was
 * pressed; never fails the sign-in.
 *  - Offline: remembered, and the scheduler tries again every minute.
 *  - The email already has a cloud account: with the password just typed, try signing in to it
 *    (it's usually the same person, e.g. who signed up on the phone first) and merge. Otherwise
 *    it "needs attention": Settings asks for that account's password.
 *  - No email yet (an account from before email sign-in): waits until one is added.
 * `moved`/`session` as for link(): the account id changed, so the app signs in afresh.
 */
export async function autoLink(userIdRaw: string, password?: string) {
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  if (!cloudApiUrl()) return { result: "unavailable" as const, moved: false, userId: userIdRaw, status: await status(userIdRaw) };
  if (await SyncLink.exists({ userId })) return { result: "linked" as const, moved: false, userId: userIdRaw, status: await status(userIdRaw) };
  await SyncIntent.updateOne({ userId }, { $setOnInsert: { attention: null } }, { upsert: true });

  const account: any = await usermodel.collection.findOne({ _id: userId });
  if (!account?.email) {
    await SyncIntent.updateOne({ userId }, { $set: { attention: "needs-email", message: NEEDS_EMAIL_MESSAGE } });
    return { result: "needs-attention" as const, moved: false, userId: userIdRaw, status: await status(userIdRaw) };
  }

  try {
    const done = await link(userIdRaw, { mode: "create" });
    return { result: "linked" as const, ...done };
  } catch (error: any) {
    if (isOffline(error)) {
      await SyncIntent.updateOne({ userId }, { $set: { attention: null, message: error.message } });
      return { result: "waiting" as const, moved: false, userId: userIdRaw, status: await status(userIdRaw) };
    }
    if (isTaken(error) && password) {
      // The same person's cloud account? Their email, with the password they just typed.
      try {
        const done = await link(userIdRaw, { mode: "signin", email: String(account.email), password });
        return { result: "linked" as const, ...done };
      } catch {
        /* a different password: ask the person */
      }
    }
    await SyncIntent.updateOne(
      { userId },
      { $set: { attention: isTaken(error) ? "email-taken" : "failed", message: isTaken(error) ? EMAIL_TAKEN_MESSAGE : error?.message ?? "Couldn't turn on sync." } },
    );
    return { result: "needs-attention" as const, moved: false, userId: userIdRaw, status: await status(userIdRaw) };
  }
}

/** An email was just added: a "Sync with my other devices" that waited for one tries again. */
export async function autoLinkIfWaiting(userIdRaw: string) {
  const intent: any = await SyncIntent.findOne({ userId: new mongoose.Types.ObjectId(userIdRaw) }).lean();
  if (intent && (intent.attention === "needs-email" || intent.attention === null)) await autoLink(userIdRaw);
}

/** The person chose not to sync after all ("Not now" on the notice, or "Stop syncing"). */
export async function dropAutoLink(userIdRaw: string) {
  await SyncIntent.deleteOne({ userId: new mongoose.Types.ObjectId(userIdRaw) });
  return status(userIdRaw);
}

async function saveLink(userId: mongoose.Types.ObjectId, cloud: { username: string; email: string | null }, tokens: { accessToken: string; refreshToken: string }) {
  await SyncLink.updateOne(
    { userId },
    {
      $set: { cloudUrl: cloudApiUrl(), cloudUsername: cloud.username || cloud.email || "account", cloudEmail: cloud.email, ...tokens, needsSignIn: false, lastError: null },
      $setOnInsert: { cursor: null },
    },
    { upsert: true },
  );
}

/** Every local record of `from` moves to `to` (this PC's account takes the cloud account's id). */
async function moveLocalAccount(from: mongoose.Types.ObjectId, to: mongoose.Types.ObjectId) {
  for (const coll of SYNCED) await coll.model.collection.updateMany({ userId: from }, { $set: { userId: to }, $unset: { _syncedUpdatedAt: "" } });
  await EpicOwnership.collection.updateMany({ userId: from }, { $set: { userId: to } });
  await Tombstone.collection.updateMany({ userId: from }, { $set: { userId: to } });
  await SyncLink.deleteMany({ userId: from });
  await RefreshToken.deleteMany({ userId: from });
  const user: any = await usermodel.collection.findOne({ _id: from });
  await usermodel.collection.deleteOne({ _id: from });
  if (user) await usermodel.collection.insertOne({ ...user, _id: to });
}

/**
 * Link this PC's account.
 *  - "create": a new cloud account with this account's id, email and password; everything here
 *    goes up. Whatever isn't given comes from this PC's account, so its password works on the
 *    phone too.
 *  - "signin": an existing cloud account (by email); this PC's data moves to it and merges.
 * Returns `moved` when the account id changed (the app must sign in again with new tokens).
 */
export async function link(userIdRaw: string, input: { mode: "create" | "signin"; email?: string; password?: string }) {
  if (isCloud()) throw new AppError("Not available in the cloud.", 400);
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  if (await SyncLink.exists({ userId, needsSignIn: false })) throw new AppError("This account already syncs with RoninArc Cloud.", 409);
  const account: any = await usermodel.collection.findOne({ _id: userId });
  const email = String(input.email?.trim() || account?.email || "").toLowerCase();
  if (!email) throw new AppError(NEEDS_EMAIL_MESSAGE, 400);
  const password = String(input.password ?? "");

  let cloudId: mongoose.Types.ObjectId;
  let tokens: { accessToken: string; refreshToken: string };
  let cloudHandle = "";
  try {
    if (input.mode === "create") {
      const secret = password ? { password } : { passwordHash: account?.passwordHash };
      // Long: a cloud that's been idle can take this long to wake up.
      const { data } = await http(CLOUD_WAKE_TIMEOUT_MS).post("/sync/register", {
        email,
        displayName: account?.displayName || account?.username,
        // This PC's handle, kept in the cloud when it's free there.
        username: account?.username,
        ...secret,
        userId: String(userId),
      });
      tokens = tokensFrom(data);
      // Never trust that the account is ours: pushing into another would mix two libraries.
      const me = await http().get("/auth/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      if (String(me.data?.Data?.id) !== String(userId)) throw new AppError(EMAIL_TAKEN_MESSAGE, 409);
      cloudHandle = String(me.data?.Data?.username ?? "");
      cloudId = userId;
    } else {
      const { data } = await http().post("/auth/login", { email, password });
      tokens = tokensFrom(data);
      const me = await http().get("/auth/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      cloudId = new mongoose.Types.ObjectId(String(me.data?.Data?.id ?? me.data?.id ?? me.data?.data?.id));
      cloudHandle = String(me.data?.Data?.username ?? "");
    }
  } catch (error) {
    throw cloudError(error, input.mode === "create" ? "Couldn't create the cloud account." : "Couldn't sign in to RoninArc Cloud.");
  }

  const moved = !cloudId.equals(userId);
  if (moved) await moveLocalAccount(userId, cloudId);
  await saveLink(cloudId, { username: cloudHandle || account?.username, email }, tokens);
  await SyncIntent.deleteMany({ userId: { $in: [userId, cloudId] } });
  await syncNow(String(cloudId));
  return { moved, userId: String(cloudId), status: await status(String(cloudId)) };
}

/** Sign in again after the cloud refused this PC's session (e.g. the password was changed). */
export async function reconnect(userIdRaw: string, password: string) {
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  const existing: any = await SyncLink.findOne({ userId }).lean();
  if (!existing) throw new AppError("This account doesn't sync with RoninArc Cloud.", 404);
  try {
    const account: any = await usermodel.collection.findOne({ _id: userId });
    const email = existing.cloudEmail || account?.email;
    // The cloud signs in by email only; a link from before email sign-in uses the account's email.
    if (!email) throw new AppError(NEEDS_EMAIL_MESSAGE, 400);
    const { data } = await http().post("/auth/login", { email, password });
    await saveLink(userId, { username: existing.cloudUsername, email }, tokensFrom(data));
  } catch (error) {
    throw cloudError(error, "Couldn't sign in to RoninArc Cloud.");
  }
  await syncNow(String(userId));
  return status(String(userId));
}

/** Stop syncing. Everything stays on this PC; the cloud keeps its copy. */
export async function unlink(userIdRaw: string) {
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  const existing: any = await SyncLink.findOne({ userId }).lean();
  if (existing) {
    await axios.post(`${cloudApiUrl()}/auth/logout`, { refreshToken: existing.refreshToken }, { timeout: 8000 }).catch(() => {});
    await SyncLink.deleteOne({ userId });
  }
  for (const coll of SYNCED) await coll.model.collection.updateMany({ userId }, { $unset: { _syncedUpdatedAt: "" } });
  await Tombstone.deleteMany({ userId });
  return status(String(userId));
}

/**
 * Sign-in on this PC with a cloud account (a new PC, or a password reset through the cloud).
 * Returns the local user to sign in, or undefined when the cloud can't vouch for these details.
 */
export async function signInThroughCloud(email: string, password: string): Promise<any | undefined> {
  if (isCloud() || !cloudApiUrl()) return undefined;
  let tokens: { accessToken: string; refreshToken: string };
  let cloudId: mongoose.Types.ObjectId;
  let cloud: any;
  try {
    // Short: this also runs on a wrong password, and offline that shouldn't keep anyone waiting.
    const { data } = await http(8_000).post("/auth/login", { email, password });
    tokens = tokensFrom(data);
    const me = await http(8_000).get("/auth/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    cloud = me.data?.Data ?? {};
    cloudId = new mongoose.Types.ObjectId(String(cloud.id ?? me.data?.id ?? me.data?.data?.id));
  } catch {
    return undefined;
  }
  const cloudEmail = String(cloud.email || email).toLowerCase();
  const local: any = await usermodel.collection.findOne({ _id: cloudId });
  if (!local) {
    // Another account on this PC already uses the email: never mix two people's libraries.
    if (await usermodel.collection.findOne({ email: cloudEmail })) return undefined;
    // A new PC: this account's library comes down from the cloud. The handle is internal; if this
    // PC already has it, a variant does (the next pull doesn't overwrite a taken one).
    let handle = String(cloud.username || cloudEmail.split("@")[0]).toLowerCase();
    if (await usermodel.collection.findOne({ username: handle })) handle = `${handle}-${String(cloudId).slice(-6)}`;
    await usermodel.collection.insertOne({
      _id: cloudId,
      username: handle,
      displayName: cloud.displayName || undefined,
      email: cloudEmail,
      passwordHash: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  await saveLink(cloudId, { username: String(cloud.username ?? ""), email: cloudEmail }, tokens);
  await syncNow(String(cloudId));
  return usermodel.findById(cloudId);
}

/** The PC's own cloud session for this account, for actions the cloud must do first. */
export async function cloudSession(userIdRaw: string) {
  const link: any = await SyncLink.findOne({ userId: new mongoose.Types.ObjectId(userIdRaw) }).lean();
  return link && !link.needsSignIn ? link : undefined;
}

export { withCloud, cloudError, http as cloudHttp };
