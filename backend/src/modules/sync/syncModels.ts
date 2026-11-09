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
    /** The cloud account's internal handle (older links); cloudEmail is what signs in. */
    cloudUsername: { type: String, required: true },
    cloudEmail: { type: String, default: null },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    /** Server time of the last pull: the next pull asks for changes after it. */
    cursor: { type: Date, default: null },
    lastSyncAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    /** The cloud refused this PC's session (password changed, account deleted): sign in again. */
    needsSignIn: { type: Boolean, default: false },
    /** When a phone first signed in to this account (from the cloud's profile): no more "get it on your phone". */
    phoneLinkedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const SyncLink = mongoose.model("SyncLink", syncLinkSchema);

/**
 * Local only: "Sync with my other devices" was ticked at sign-in but linking hasn't worked yet
 * (offline, the email already has a cloud account whose password differs, or there's no email yet).
 * Offline it's retried every minute; the others wait for the person ("needs attention" in Settings).
 */
const syncIntentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    /** Why it needs the person: "email-taken", "needs-email" or "failed". Null while it just waits for internet. */
    attention: { type: String, default: null },
    message: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

export const SyncIntent = mongoose.model("SyncIntent", syncIntentSchema);

/**
 * Cloud only: a 6-digit code a linked PC shows (with a QR code) so a phone signs in without a
 * password. Stored as an HMAC, single use, gone after ten minutes; one per account at a time.
 */
const linkCodeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    codeHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);
linkCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LinkCode = mongoose.model("LinkCode", linkCodeSchema);

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
