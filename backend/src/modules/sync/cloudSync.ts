import mongoose from "mongoose";
import AppError from "../../shared/errors/AppError";
import usermodel from "../auth/models/User";
import { Tombstone } from "./syncModels";
import { CLOUD_META, LOCAL_META, SYNCED, changedAt, forWire, syncedByName, type SyncedCollection } from "./syncCollections";

const { EJSON } = mongoose.mongo.BSON;

/** Pulls look back a little, so a change committed in the same instant as the cursor isn't missed. */
const PULL_OVERLAP_MS = 5000;
const PULL_LIMIT = 5000;
const PUSH_LIMIT = 5000;

export interface PushBody {
  changes?: Record<string, any[]>;
  deletes?: { coll: string; id: any; deletedAt: any }[];
}

export interface PushResult {
  /** Ids the cloud took (by collection), with the version the device sent. */
  accepted: Record<string, { id: string; updatedAt: string }[]>;
  /** The cloud's newer version, for each pushed change it kept instead. */
  rejected: Record<string, any[]>;
  /** A device id merged into an existing one (the same game added on two devices). */
  remapped: { coll: string; from: string; to: string }[];
  deletesAccepted: string[];
}

const isId = (v: unknown) => mongoose.isValidObjectId(v) && String(new mongoose.Types.ObjectId(String(v))) === String(v);

/** Only plain data the app's own models would write: no operators, no smuggled owners. */
function clean(coll: SyncedCollection, raw: any, userId: mongoose.Types.ObjectId) {
  const doc: any = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (k.startsWith("$") || k.includes(".")) continue;
    if ((CLOUD_META as readonly string[]).includes(k) || (LOCAL_META as readonly string[]).includes(k) || k === "__v") continue;
    if (coll.localOnly?.includes(k)) continue;
    doc[k] = v;
  }
  doc.userId = userId;
  return doc;
}

/**
 * A device's changes since its last sync. Newer change wins (by when it was made on the
 * device); the same thing made twice offline is merged; ids that merged away are rewritten in
 * everything that points at them, in this push and in what the cloud already has.
 */
export async function applyPush(userIdRaw: string, body: PushBody): Promise<PushResult> {
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  const result: PushResult = { accepted: {}, rejected: {}, remapped: [], deletesAccepted: [] };
  const remap = new Map<string, string>(); // `${coll}:${from}` -> to
  const total = Object.values(body.changes ?? {}).reduce((n, docs) => n + (Array.isArray(docs) ? docs.length : 0), 0) + (body.deletes?.length ?? 0);
  if (total > PUSH_LIMIT) throw new AppError(`Too many changes in one push (max ${PUSH_LIMIT}).`, 413);

  for (const coll of SYNCED) {
    const incoming = body.changes?.[coll.name];
    if (!Array.isArray(incoming) || incoming.length === 0) continue;
    const raw = coll.model.collection;
    for (const wire of incoming) {
      const parsed = EJSON.deserialize(wire);
      if (!isId(parsed?._id)) continue;
      const doc = clean(coll, parsed, userId);
      // Points at an id that merged away earlier in this push: use the survivor.
      for (const ref of coll.refs ?? []) {
        const to = (id: any) => (id && remap.has(`${ref.coll}:${id}`) ? new mongoose.Types.ObjectId(remap.get(`${ref.coll}:${id}`)!) : id);
        if (ref.array && Array.isArray(doc[ref.field])) doc[ref.field] = doc[ref.field].map(to);
        else if (doc[ref.field]) doc[ref.field] = to(doc[ref.field]);
      }
      const authored = doc.updatedAt ? new Date(doc.updatedAt) : new Date();
      const sentId = String(doc._id);

      let existing: any = await raw.findOne({ _id: doc._id });
      if (existing && String(existing.userId) !== String(userId)) continue; // someone else's id: ignore
      let mergedFrom: any = null;
      if (!existing && coll.naturalKey && coll.naturalKey.every((k) => doc[k] !== undefined && doc[k] !== null)) {
        const key: any = { userId };
        for (const k of coll.naturalKey) key[k] = doc[k];
        existing = await raw.findOne(key);
        if (existing) {
          mergedFrom = doc._id;
          remap.set(`${coll.name}:${sentId}`, String(existing._id));
          result.remapped.push({ coll: coll.name, from: sentId, to: String(existing._id) });
          doc._id = existing._id;
          await rewriteRefs(coll.name, mergedFrom, existing._id, userId);
        }
      }

      if (existing && changedAt(existing) >= authored && !mergedFrom) {
        (result.rejected[coll.name] ??= []).push(EJSON.serialize(existing));
        continue;
      }

      const now = new Date();
      let next = { ...doc, updatedAt: now, _changedAt: authored, _appliedAt: now };
      if (existing && mergedFrom) {
        // Same thing on two devices: keep the newer content, combine where that makes sense.
        const existingNewer = changedAt(existing) >= authored;
        const winner = existingNewer ? { ...existing } : next;
        const loser = existingNewer ? next : existing;
        next = coll.merge ? coll.merge(winner, loser) : winner;
        next = { ...next, _id: existing._id, userId, updatedAt: now, _changedAt: existingNewer ? changedAt(existing) : authored, _appliedAt: now };
      }
      if (!next.createdAt) next.createdAt = existing?.createdAt ?? authored;
      await raw.replaceOne({ _id: next._id }, next, { upsert: true });
      (result.accepted[coll.name] ??= []).push({ id: sentId, updatedAt: authored.toISOString() });
    }
  }

  for (const del of body.deletes ?? []) {
    const coll = syncedByName.get(del?.coll);
    const id = EJSON.deserialize({ id: del?.id }).id;
    if (!coll || !isId(id)) continue;
    const deletedAt = new Date(EJSON.deserialize({ d: del.deletedAt }).d ?? Date.now());
    const existing: any = await coll.model.collection.findOne({ _id: new mongoose.Types.ObjectId(String(id)) });
    if (!existing) {
      result.deletesAccepted.push(String(id));
      continue;
    }
    if (String(existing.userId) !== String(userId)) continue;
    if (changedAt(existing) > deletedAt) {
      // Edited elsewhere after this device deleted it: the edit wins, the device gets it back.
      (result.rejected[coll.name] ??= []).push(EJSON.serialize(existing));
      continue;
    }
    // Through the model, so the cloud records its own tombstone for the other devices.
    await coll.model.deleteOne({ _id: existing._id, userId });
    result.deletesAccepted.push(String(id));
  }
  return result;
}

/** Everything that pointed at a merged-away id now points at the survivor. */
async function rewriteRefs(collName: string, from: any, to: any, userId: mongoose.Types.ObjectId) {
  const now = new Date();
  for (const c of SYNCED) {
    for (const ref of c.refs ?? []) {
      if (ref.coll !== collName) continue;
      if (ref.array) {
        await c.model.collection.updateMany({ userId, [ref.field]: from }, { $set: { [`${ref.field}.$[x]`]: to, updatedAt: now } }, { arrayFilters: [{ x: from }] });
      } else {
        await c.model.collection.updateMany({ userId, [ref.field]: from }, { $set: { [ref.field]: to, updatedAt: now } });
      }
    }
  }
}

/** What changed for this user since `since` (server time), plus the profile a PC needs to sign in offline. */
export async function pull(userIdRaw: string, sinceRaw?: string) {
  const userId = new mongoose.Types.ObjectId(userIdRaw);
  const serverTime = new Date();
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw)) ? new Date(Date.parse(sinceRaw) - PULL_OVERLAP_MS) : new Date(0);
  const changes: Record<string, any[]> = {};
  let hasMore = false;
  let cursor = serverTime;
  for (const coll of SYNCED) {
    const docs = await coll.model.collection.find({ userId, updatedAt: { $gt: since } }).sort({ updatedAt: 1 }).limit(PULL_LIMIT).toArray();
    if (docs.length === PULL_LIMIT) {
      hasMore = true;
      const last = docs[docs.length - 1].updatedAt as Date;
      if (last < cursor) cursor = last;
    }
    if (docs.length) changes[coll.name] = docs.map((d) => EJSON.serialize(forWire(coll, d)));
  }
  const tombstones = await Tombstone.find({ userId, deletedAt: { $gt: since } }).sort({ deletedAt: 1 }).limit(PULL_LIMIT).lean();
  const user = await usermodel.findById(userId).select("username email passwordHash updatedAt").lean();
  if (!user) throw new AppError("User not found", 404);
  return {
    serverTime: serverTime.toISOString(),
    cursor: cursor.toISOString(),
    hasMore,
    changes,
    deletes: tombstones.map((t) => ({ coll: t.coll, id: String(t.docId), deletedAt: (t.deletedAt as Date).toISOString() })),
    // A PC linked to this account signs in offline with the cloud password.
    user: { id: String(user._id), username: user.username, email: user.email ?? null, passwordHash: user.passwordHash },
  };
}
