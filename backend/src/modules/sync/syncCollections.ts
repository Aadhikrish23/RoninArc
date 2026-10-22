import mongoose from "mongoose";
import gameLibrarymodel from "../library/LibraryGame";
import Note from "../notes/Notemodel";
import Review from "../review/Reviewmodel";
import Collection from "../collection/CollectionModel";
import Activity from "../activity/ActivityModel";
import PlaySession from "../playSession/PlaySessionModel";
import RecommendationFeedback from "../recommendation/RecommendationFeedback";

export interface SyncedCollection {
  /** Name used on the wire and in tombstones. */
  name: string;
  model: mongoose.Model<any>;
  /**
   * Fields that identify "the same thing" across devices, besides userId. Two devices adding the
   * same game offline make two ids for one game; the cloud merges them and tells the device
   * which id won.
   */
  naturalKey?: string[];
  /** Fields that belong to one PC and never sync (a game's .exe path differs per PC). */
  localOnly?: string[];
  /** Fields pointing at another synced collection's ids, rewritten when an id is merged away. */
  refs?: { coll: string; field: string; array?: boolean }[];
  /** For a natural-key merge: combine both versions instead of keeping only the newer one. */
  merge?: (winner: any, loser: any) => any;
}

const unionIds = (a: unknown[] = [], b: unknown[] = []) => {
  const seen = new Set<string>();
  return [...a, ...b].filter((id) => {
    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** In dependency order: games before what points at them, so merges are known first. */
export const SYNCED: SyncedCollection[] = [
  { name: "games", model: gameLibrarymodel, naturalKey: ["rawgId"], localOnly: ["exePath"] },
  {
    name: "collections",
    model: Collection,
    naturalKey: ["name"],
    refs: [{ coll: "games", field: "gameIds", array: true }],
    // "Soulslikes" made on the phone and on the PC: one collection with both lists.
    merge: (winner, loser) => ({ ...winner, gameIds: unionIds(winner.gameIds, loser.gameIds) }),
  },
  { name: "reviews", model: Review, naturalKey: ["gameId"], refs: [{ coll: "games", field: "gameId" }] },
  { name: "notes", model: Note, refs: [{ coll: "games", field: "gameId" }] },
  { name: "playSessions", model: PlaySession, refs: [{ coll: "games", field: "gameId" }] },
  {
    name: "activities",
    model: Activity,
    refs: [
      { coll: "games", field: "gameId" },
      { coll: "collections", field: "collectionId" },
    ],
  },
  { name: "feedback", model: RecommendationFeedback, naturalKey: ["rawgId"] },
];

export const syncedByName = new Map(SYNCED.map((c) => [c.name, c]));

/** Bookkeeping fields: the cloud's (when it applied a pushed change) and the device's (last synced version). */
export const CLOUD_META = ["_changedAt", "_appliedAt"] as const;
export const LOCAL_META = ["_syncedUpdatedAt"] as const;

/**
 * When a document last changed, in the author's terms. A change pushed from a device keeps
 * the device's time (`_changedAt`) while the cloud stamps `updatedAt` with its own clock for
 * pulling; a later edit through the cloud's own API moves `updatedAt` past `_appliedAt`.
 */
export function changedAt(doc: any): Date {
  const updated = doc?.updatedAt ? new Date(doc.updatedAt) : new Date(0);
  if (doc?._appliedAt && doc?._changedAt && +new Date(doc._appliedAt) === +updated) return new Date(doc._changedAt);
  return updated;
}

/** A copy without sync bookkeeping and this-PC-only fields. */
export function forWire(coll: SyncedCollection, doc: any): any {
  const out = { ...doc };
  for (const f of [...(coll.localOnly ?? []), ...LOCAL_META]) delete out[f];
  delete out.__v;
  return out;
}
