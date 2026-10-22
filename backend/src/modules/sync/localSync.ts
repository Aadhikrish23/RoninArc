import axios, { type AxiosInstance } from "axios";
import mongoose from "mongoose";
import AppError from "../../shared/errors/AppError";
import { cloudApiUrl, isCloud } from "../../shared/runtimeMode";
import { moduleLogger } from "../../shared/logging/logger";
import usermodel from "../auth/models/User";
import RefreshToken from "../auth/models/RefreshToken";
import EpicOwnership from "../providers/epic/models/EpicOwnership";
import { SyncLink, Tombstone } from "./syncModels";
import { CLOUD_META, SYNCED, changedAt, forWire, syncedByName, type SyncedCollection } from "./syncCollections";

const { EJSON } = mongoose.mongo.BSON;
const log = moduleLogger("sync");

const PUSH_BATCH = 1000;
const SYNC_EVERY_MS = 60_000;
const AFTER_CHANGE_MS = 4_000;
const HTTP_TIMEOUT_MS = 20_000;

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
  if (!coll.naturalKey || !coll.naturalKey.every((k) => doc[k] !== undefined && doc[k] !== null)) return undefined;
  const f: any = { userId: doc.userId, _id: { $ne: doc._id } };
  for (const k of coll.naturalKey) f[k] = doc[k];
  return f;
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
  if (user.username) {
    const taken = await usermodel.collection.findOne({ username: user.username, _id: { $ne: new mongoose.Types.ObjectId(user.id) } });
    if (!taken) set.username = user.username;
  }
  await usermodel.collection.updateOne({ _id: new mongoose.Types.ObjectId(user.id) }, { $set: set });
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
  return {
    available: !!cloudApiUrl(),
    linked: !!link,
    cloudUsername: link?.cloudUsername ?? null,
    lastSyncAt: link?.lastSyncAt ?? null,
    lastError: link?.lastError ?? null,
    needsSignIn: !!link?.needsSignIn,
    pending: link ? await pendingCounts(userId) : { changes: 0, deletes: 0 },
  };
}

async function saveLink(userId: mongoose.Types.ObjectId, cloudUsername: string, tokens: { accessToken: string; refreshToken: string }) {
  await SyncLink.updateOne(
    { userId },
    { $set: { cloudUrl: cloudApiUrl(), cloudUsername, ...tokens, needsSignIn: false, lastError: null }, $setOnInsert: { cursor: null } },
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
 *  - "create": a new cloud account with this account's id; everything here goes up.
 *  - "signin": an existing cloud account; this PC's data moves to it and merges.
 * Returns `moved` when the account id changed (the app must sign in again with new tokens).
 */
export async function link(userIdRaw: string, input: { mode: "create" | "signin"; username: string; email?: string; password: string }) {
  if (isCloud()) throw new AppError("Not available in the cloud.", 400);
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  if (await SyncLink.exists({ userId, needsSignIn: false })) throw new AppError("This account already syncs with RoninArc Cloud.", 409);
  const username = String(input.username ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");

  let cloudId: mongoose.Types.ObjectId;
  let tokens: { accessToken: string; refreshToken: string };
  try {
    if (input.mode === "create") {
      const { data } = await http().post("/sync/register", { username, email: input.email, password, userId: String(userId) });
      tokens = tokensFrom(data);
      // Never trust that the account is ours: pushing into another would mix two libraries.
      const me = await http().get("/auth/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      if (String(me.data?.Data?.id) !== String(userId)) throw new AppError("That cloud account name is taken. Pick another, or sign in to it instead.", 409);
      cloudId = userId;
    } else {
      const { data } = await http().post("/auth/login", { username, password });
      tokens = tokensFrom(data);
      const me = await http().get("/auth/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
      cloudId = new mongoose.Types.ObjectId(String(me.data?.Data?.id ?? me.data?.id ?? me.data?.data?.id));
    }
  } catch (error) {
    throw cloudError(error, input.mode === "create" ? "Couldn't create the cloud account." : "Couldn't sign in to RoninArc Cloud.");
  }

  const moved = !cloudId.equals(userId);
  if (moved) await moveLocalAccount(userId, cloudId);
  await saveLink(cloudId, username, tokens);
  await syncNow(String(cloudId));
  return { moved, userId: String(cloudId), status: await status(String(cloudId)) };
}

/** Sign in again after the cloud refused this PC's session (e.g. the password was changed). */
export async function reconnect(userIdRaw: string, password: string) {
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  const existing: any = await SyncLink.findOne({ userId }).lean();
  if (!existing) throw new AppError("This account doesn't sync with RoninArc Cloud.", 404);
  try {
    const { data } = await http().post("/auth/login", { username: existing.cloudUsername, password });
    await saveLink(userId, existing.cloudUsername, tokensFrom(data));
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
export async function signInThroughCloud(username: string, password: string): Promise<any | undefined> {
  if (isCloud() || !cloudApiUrl()) return undefined;
  let tokens: { accessToken: string; refreshToken: string };
  let cloudId: mongoose.Types.ObjectId;
  try {
    // Short: this also runs on a wrong password, and offline that shouldn't keep anyone waiting.
    const { data } = await http(8_000).post("/auth/login", { username, password });
    tokens = tokensFrom(data);
    const me = await http(8_000).get("/auth/me", { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
    cloudId = new mongoose.Types.ObjectId(String(me.data?.Data?.id ?? me.data?.id ?? me.data?.data?.id));
  } catch {
    return undefined;
  }
  const local: any = await usermodel.collection.findOne({ _id: cloudId });
  if (!local) {
    // A new PC: this account's library comes down from the cloud.
    if (await usermodel.collection.findOne({ username })) return undefined; // a different local account has this name
    await usermodel.collection.insertOne({ _id: cloudId, username, passwordHash: "", createdAt: new Date(), updatedAt: new Date() });
  }
  await saveLink(cloudId, username, tokens);
  await syncNow(String(cloudId));
  return usermodel.findById(cloudId);
}

/** The PC's own cloud session for this account, for actions the cloud must do first. */
export async function cloudSession(userIdRaw: string) {
  const link: any = await SyncLink.findOne({ userId: new mongoose.Types.ObjectId(userIdRaw) }).lean();
  return link && !link.needsSignIn ? link : undefined;
}

export { withCloud, cloudError, http as cloudHttp };
