import { Types } from "mongoose";
import LibraryGame from "../../library/LibraryGame";
import libraryServices from "../../library/libraryServices";
import Review from "../../review/Reviewmodel";
import Note from "../../notes/Notemodel";
import CollectionModel from "../../collection/CollectionModel";
import Activity from "../../activity/ActivityModel";
import RecommendationFeedback from "../../recommendation/RecommendationFeedback";
import reviewToolService from "../services/ReviewToolService";
import { IntentPlan } from "../intent/IntentPlan";
import { IntentType } from "../intent/IntentType";
import { IntentTargetType } from "../intent/IntentTargetType";
import { READ_ONLY, sameGame } from "../conversation/TargetGrounding";

/**
 * The assistant's last change, so "undo" and "no, I said the witcher" can put things back.
 * Covers what a chat message changes on a game: status, rating/review, notes added, and
 * games added. Collection moves aren't recorded.
 */

interface GameBefore {
  gameId: string;
  title: string;
  status: string;
  review: { rating: number; reviewText: string } | null;
}

export interface LastChange {
  at: Date;
  games: GameBefore[];
  /** Titles the plan was adding (not owned before). */
  adding: string[];
  /** Games the plan removed, kept whole so "undo" / "add it back" can restore them. */
  removed?: RemovedGame[];
}

interface RemovedGame {
  game: Record<string, unknown>;
  review: { rating: number; reviewText: string } | null;
  notes: string[];
  collectionIds: string[];
}

const CHANGES = new Set<string>([
  IntentType.SetStatus, IntentType.CompleteGame, IntentType.RateGame, IntentType.ReviewGame,
  IntentType.DeleteReview, IntentType.AddNote, IntentType.AddGame, IntentType.RemoveGame,
]);
/** How long "undo" reaches back. */
const UNDO_WINDOW_MS = 30 * 60 * 1000;

const lastChanges = new Map<string, LastChange>();

const STATUS_WORDS: Record<string, string> = {
  plan: "Plan to Play", playing: "Playing", paused: "Paused", completed: "Completed", dropped: "Dropped", none: "No Status",
};

/** What the plan is about to change, captured before it runs. Undefined when it changes nothing undoable. */
export async function snapshotBefore(userId: string, plan: IntentPlan): Promise<LastChange | undefined> {
  const intents = plan.intents.filter((i) => CHANGES.has(i.type));
  if (intents.length === 0) return undefined;
  const owned = ((await LibraryGame.find({ userId: new Types.ObjectId(userId) }).select("title").lean()) as any[]).map((g) => g.title as string);
  const names = intents.flatMap((i) => (i.targets ?? []).filter((t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library).map((t) => t.name));
  const ownedTitles = [...new Set(names.map((n) => owned.find((t) => sameGame(n, t))).filter((t): t is string => !!t))];
  const adding = intents
    .filter((i) => i.type === IntentType.AddGame)
    .map((i) => i.targets?.[0]?.name ?? "")
    .filter((n) => n && !owned.some((t) => sameGame(n, t)));

  const uid = new Types.ObjectId(userId);
  const games = (await LibraryGame.find({ userId: uid, title: { $in: ownedTitles } }).select("_id title progressStatus").lean()) as any[];
  const reviews = (await Review.find({ userId: uid, gameId: { $in: games.map((g) => g._id) } }).lean()) as any[];

  // A removal deletes the game with its review, notes and collection places: keep a copy.
  const removing = new Set(
    intents
      .filter((i) => i.type === IntentType.RemoveGame)
      .flatMap((i) => (i.targets ?? []).map((t) => owned.find((o) => sameGame(t.name, o))))
      .filter((t): t is string => !!t),
  );
  const removed: RemovedGame[] = [];
  for (const title of removing) {
    const game = (await LibraryGame.findOne({ userId: uid, title }).lean()) as any;
    if (!game) continue;
    const review = reviews.find((r) => String(r.gameId) === String(game._id)) ?? ((await Review.findOne({ userId: uid, gameId: game._id }).lean()) as any);
    const notes = ((await Note.find({ userId: uid, gameId: game._id }).sort({ createdAt: 1 }).lean()) as any[]).map((n) => n.content as string);
    const collections = (await CollectionModel.find({ userId: uid, gameIds: game._id }).select("_id").lean()) as any[];
    removed.push({
      game,
      review: review ? { rating: review.rating, reviewText: review.reviewText ?? "" } : null,
      notes,
      collectionIds: collections.map((c) => String(c._id)),
    });
  }

  return {
    at: new Date(),
    adding,
    removed,
    games: games.map((g) => {
      const review = reviews.find((r) => String(r.gameId) === String(g._id));
      return {
        gameId: String(g._id),
        title: g.title,
        status: g.progressStatus || "none",
        review: review ? { rating: review.rating, reviewText: review.reviewText ?? "" } : null,
      };
    }),
  };
}

export function rememberChange(userId: string, change: LastChange) {
  lastChanges.set(userId, change);
}

/** A change undo can't put back (collection moves, renames): "undo" must not reach past it. */
export function forgetChange(userId: string) {
  lastChanges.delete(userId);
}

/** Does the plan change anything undo can't restore? */
export function hasUntrackedChanges(plan: IntentPlan): boolean {
  return plan.intents.some((i) => !CHANGES.has(i.type) && !READ_ONLY.has(i.type) && i.type !== IntentType.AskQuestion && i.type !== IntentType.Help);
}

export function lastChange(userId: string): LastChange | undefined {
  const change = lastChanges.get(userId);
  return change && Date.now() - change.at.getTime() < UNDO_WINDOW_MS ? change : undefined;
}

/** Puts back what the last change touched. Returns a description of what was undone. */
export async function undoLastChange(userId: string, only?: string): Promise<string | undefined> {
  const change = lastChange(userId);
  if (!change) return undefined;
  // "undo the cod one": just that game; the rest of the change stays (and stays undoable).
  const pick = (title: string) => !only || sameGame(only, title) || sameGame(title, only);
  const games = change.games.filter((g) => pick(g.title));
  const adding = change.adding.filter((t) => pick(t));
  const removedPicked = (change.removed ?? []).filter((r) => pick(String(r.game.title)));
  if (only && games.length === 0 && adding.length === 0 && removedPicked.length === 0) return undefined;
  const keptGames = change.games.filter((g) => !games.includes(g));
  const keptAdding = change.adding.filter((t) => !adding.includes(t));
  if (keptGames.length > 0 || keptAdding.length > 0) lastChanges.set(userId, { ...change, games: keptGames, adding: keptAdding });
  else lastChanges.delete(userId);
  const uid = new Types.ObjectId(userId);
  const done: string[] = [];

  for (const before of games) {
    const game = (await LibraryGame.findOne({ _id: before.gameId, userId: uid }).select("progressStatus").lean()) as any;
    if (!game) continue;
    const parts: string[] = [];
    if ((game.progressStatus || "none") !== before.status) {
      // Put the status back as if it never changed: no new "marked as" entry, and the entries the
      // undone change made go too (the dashboard dates "planned" games by them).
      await LibraryGame.updateOne({ _id: before.gameId, userId: uid }, { $set: { progressStatus: before.status } });
      await Activity.deleteMany({ userId: uid, gameId: before.gameId, type: "STATUS_CHANGED", createdAt: { $gte: change.at } });
      parts.push(`status back to ${STATUS_WORDS[before.status] ?? before.status}`);
    }
    const review = (await Review.findOne({ userId: uid, gameId: before.gameId }).lean()) as any;
    const sameReview = review && before.review && review.rating === before.review.rating && (review.reviewText ?? "") === before.review.reviewText;
    if (!before.review && review) {
      await reviewToolService.deleteReview(userId, before.gameId);
      parts.push("rating removed");
    } else if (before.review && !sameReview) {
      await reviewToolService.upsertReview(userId, before.gameId, before.review.rating, before.review.reviewText);
      parts.push(`rating back to ${before.review.rating}/10`);
    }
    const notes = await Note.deleteMany({ userId: uid, gameId: before.gameId, createdAt: { $gte: change.at } });
    if (notes.deletedCount) parts.push(notes.deletedCount === 1 ? "new note removed" : "new notes removed");
    if (parts.length > 0) done.push(`${before.title}: ${parts.join(", ")}`);
  }

  for (const title of adding) {
    const added = (await LibraryGame.find({ userId: uid, createdAt: { $gte: change.at } }).select("_id title rawgId").lean()) as any[];
    const game = added.find((g) => sameGame(title, g.title) || sameGame(g.title, title));
    if (!game) continue;
    await libraryServices.deleteGame(userId, String(game._id));
    // Undoing an add isn't "not interested".
    if (typeof game.rawgId === "number") await RecommendationFeedback.deleteOne({ userId: uid, rawgId: game.rawgId });
    done.push(`${game.title}: removed from your library again`);
  }

  for (const gone of change.removed ?? []) {
    if (only && !pick(String(gone.game.title))) continue;
    const { _id, updatedAt, __v, ...fields } = gone.game as any;
    // Keeps its original createdAt, so it doesn't jump to the front of "Recently Added".
    const back = (await LibraryGame.create({ ...fields, userId: uid } as any)) as any;
    // The removal didn't stick, so the activity feed shouldn't say it happened.
    await Activity.deleteMany({ userId: uid, type: "GAME_REMOVED", message: `Removed ${back.title} from library`, createdAt: { $gte: change.at } });
    // Removing marked it "not interested"; it's back, so that goes.
    if (typeof back.rawgId === "number") await RecommendationFeedback.deleteOne({ userId: uid, rawgId: back.rawgId });
    if (gone.review) await reviewToolService.upsertReview(userId, String(back._id), gone.review.rating, gone.review.reviewText);
    for (const content of gone.notes) await Note.create({ userId: uid, gameId: back._id, content });
    if (gone.collectionIds.length) {
      await CollectionModel.updateMany({ _id: { $in: gone.collectionIds }, userId: uid }, { $addToSet: { gameIds: back._id } });
    }
    done.push(`${back.title}: back in your library${gone.review || gone.notes.length ? " with its review and notes" : ""}`);
  }

  return done.length > 0 ? `I've undone that. ${done.join(". ")}.` : "There was nothing left to undo.";
}

/** For corrections: did the last change touch this game? */
export function lastChangeTouched(userId: string, title: string): boolean {
  const change = lastChange(userId);
  return !!change && (change.games.some((g) => sameGame(title, g.title)) || change.adding.some((t) => sameGame(title, t)));
}
