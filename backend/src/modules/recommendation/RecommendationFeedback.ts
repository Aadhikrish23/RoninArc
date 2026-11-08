import mongoose from "mongoose";
import { tombstonePlugin } from "../sync/tombstonePlugin";

// A game the user said "Not interested" to, so discovery stops suggesting it.
const recommendationFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rawgId: { type: Number },
    igdbId: { type: Number },
    title: { type: String, default: "", trim: true, maxlength: 300 },
  },
  // Indexes change through syncFeedbackIndexes, once the old one is out of the way.
  { timestamps: true, autoIndex: false },
);

// Each only covers entries that have that id: to a plain unique index, a missing id is a value,
// so a second game known only by its other id would count as a duplicate.
recommendationFeedbackSchema.index({ userId: 1, rawgId: 1 }, { unique: true, name: "feedback_user_rawg", partialFilterExpression: { rawgId: { $type: "number" } } });
recommendationFeedbackSchema.index({ userId: 1, igdbId: 1 }, { unique: true, name: "feedback_user_igdb", partialFilterExpression: { igdbId: { $type: "number" } } });

// Deletions are recorded so sync can pass them on (modules/sync).
recommendationFeedbackSchema.plugin(tombstonePlugin, { coll: "feedback" });

const RecommendationFeedback = mongoose.model("RecommendationFeedback", recommendationFeedbackSchema);

export default RecommendationFeedback;

/** RAWG (older entries) and IGDB use the same range of numbers for different games, so these never share a field. */
export interface GameDbIds {
  rawgId?: number | null;
  igdbId?: number | null;
}

const entriesFor = ({ rawgId, igdbId }: GameDbIds) => [
  ...(typeof igdbId === "number" ? [{ igdbId }] : []),
  ...(typeof rawgId === "number" ? [{ rawgId }] : []),
];

/** Replaces the unique index older versions made, which would refuse a second IGDB-only entry. */
export const syncFeedbackIndexes = () => RecommendationFeedback.syncIndexes();

export async function markNotInterested(userId: string | mongoose.Types.ObjectId, ids: GameDbIds, title = "") {
  const $or = entriesFor(ids);
  if ($or.length === 0) return;
  const known = Object.assign({}, ...$or);
  const set = { ...known, ...(title ? { title } : {}) };
  const updated = await RecommendationFeedback.updateOne({ userId, $or }, { $set: set });
  if (updated.matchedCount > 0) return;
  await RecommendationFeedback.create({ userId, ...set }).catch((error: any) => {
    if (error?.code !== 11000) throw error; // two requests at once: already marked
  });
}

/** Returns whether the game had been marked. */
export async function clearNotInterested(userId: string | mongoose.Types.ObjectId, ids: GameDbIds) {
  const $or = entriesFor(ids);
  if ($or.length === 0) return false;
  return (await RecommendationFeedback.deleteOne({ userId, $or })).deletedCount > 0;
}
