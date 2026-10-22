import mongoose from "mongoose";

/**
 * "This record was deleted": how a deletion reaches the other devices. Written by the
 * tombstone plugin on every app delete. Locally, `pushed` marks the ones the cloud has seen;
 * in the cloud, `deletedAt` (server time) is what devices pull by.
 */
const tombstoneSchema = new mongoose.Schema(
  {
    coll: { type: String, required: true },
    docId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    deletedAt: { type: Date, required: true },
    pushed: { type: Boolean, default: false },
  },
  { versionKey: false },
);
tombstoneSchema.index({ userId: 1, deletedAt: 1 });
tombstoneSchema.index({ userId: 1, pushed: 1 });
// History only: a device offline for more than 90 days does a full resync instead.
tombstoneSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Tombstone = mongoose.model("SyncTombstone", tombstoneSchema);

/**
 * This PC's link to a RoninArc Cloud account (local mode only; at most one per local user).
 * The cloud tokens are the PC's own session with the cloud, like a logged-in phone's.
 */
const syncLinkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    cloudUrl: { type: String, required: true },
    cloudUsername: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    /** Server time of the last pull: the next pull asks for changes after it. */
    cursor: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    /** The cloud refused this PC's session (password changed, account deleted): sign in again. */
    needsSignIn: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

export const SyncLink = mongoose.model("SyncLink", syncLinkSchema);

/** Cloud only: one row per user per UTC day, for the per-user AI limit. */
const usageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    day: { type: String, required: true },
    kind: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { versionKey: false },
);
usageSchema.index({ userId: 1, kind: 1, day: 1 }, { unique: true });

export const DailyUsage = mongoose.model("DailyUsage", usageSchema);
