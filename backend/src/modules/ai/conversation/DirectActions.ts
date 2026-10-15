import { Types } from "mongoose";
import CollectionModel from "../../collection/CollectionModel";
import collectionService from "../../collection/collectionService";
import type { CollectionCommand } from "./FollowUps";
import LibraryGame from "../../library/LibraryGame";
import Review from "../../review/Reviewmodel";
import reviewToolService from "../services/ReviewToolService";
import libraryToolService from "../services/LibraryToolService";
import rawgService from "../../rawg/rawgService";

/** Deletes or renames a collection by name. Deleting returns a confirmation step first. */
export type CollectionActionResult =
  | { kind: "reply"; message: string; success: boolean }
  | { kind: "confirm"; question: string; label: string; run: () => Promise<string> };

export async function runCollectionCommand(userId: string, command: CollectionCommand, collections: string[]): Promise<CollectionActionResult> {
  if (!command.name) {
    if (collections.length === 0) return { kind: "reply", success: true, message: "You don't have any collections yet." };
    const which = command.kind === "delete" ? "delete" : "rename";
    return {
      kind: "reply",
      success: false,
      message: `Which collection should I ${which}? You have: ${collections.map((c) => `"${c}"`).join(", ")}.`,
    };
  }
  const col = await CollectionModel.findOne({ userId: new Types.ObjectId(userId), name: command.name }).select("_id name gameIds").lean();
  if (!col) return { kind: "reply", success: false, message: `I couldn't find a collection called "${command.name}".` };

  if (command.kind === "rename") {
    try {
      await collectionService.updateCollection(userId, String(col._id), command.newName);
      return { kind: "reply", success: true, message: `I've renamed the collection "${col.name}" to "${command.newName}".` };
    } catch (error: any) {
      return { kind: "reply", success: false, message: error?.message === "Collection with this name already exists"
        ? `You already have a collection called "${command.newName}".`
        : `I couldn't rename "${col.name}".` };
    }
  }

  const count = (col.gameIds ?? []).length;
  return {
    kind: "confirm",
    label: `the collection "${col.name}"`,
    question: `Delete the collection "${col.name}"? ${count === 0 ? "It's empty." : count === 1 ? "The game in it stays in your library." : `The ${count} games in it stay in your library.`}`,
    run: async () => {
      await collectionService.deleteCollection(userId, String(col._id));
      return `I've deleted the collection "${col.name}".`;
    },
  };
}

/** The text of the user's existing review of a library game, if they wrote one. */
export async function existingReviewText(userId: string, title: string): Promise<string | undefined> {
  const uid = new Types.ObjectId(userId);
  const game = (await LibraryGame.findOne({ userId: uid, title }).select("_id").lean()) as any;
  if (!game) return undefined;
  const review = (await Review.findOne({ userId: uid, gameId: game._id }).select("reviewText").lean()) as any;
  return review?.reviewText?.trim() || undefined;
}

/** "change my review on it to: ..." -- new text; the score stays unless a new one was given. */
export async function editReview(userId: string, title: string, text: string, rating?: number): Promise<{ success: boolean; message: string }> {
  const uid = new Types.ObjectId(userId);
  const game = (await LibraryGame.findOne({ userId: uid, title }).select("_id title").lean()) as any;
  if (!game) return { success: false, message: `${title} isn't in your library.` };
  const existing = (await Review.findOne({ userId: uid, gameId: game._id }).select("rating").lean()) as any;
  const score = rating ?? existing?.rating;
  if (typeof score !== "number") {
    return { success: false, message: `What score should ${game.title} get? Say something like "review ${game.title} 9: ${text}".` };
  }
  await reviewToolService.upsertReview(userId, String(game._id), score, text);
  return { success: true, message: `I've updated your review of ${game.title}: ${score}/10 -- "${text}".` };
}

/** Collection names that describe a play style, as RAWG tag slugs. */
const COLLECTION_STYLES: [RegExp, string][] = [
  [/souls/i, "souls-like"],
  [/rogue-?lite/i, "roguelite"],
  [/rogue-?like/i, "roguelike"],
  [/metroidvania/i, "metroidvania"],
  [/\b(cozy|cosy|chill|comfy)\b/i, "cozy"],
  [/\bco-?op\b/i, "co-op"],
  [/\bhorror\b/i, "horror"],
  [/\bopen[- ]?world\b/i, "open-world"],
  [/\bjrpg/i, "jrpg"],
  [/\bstory\b/i, "story-rich"],
];

export interface FollowUpOffer {
  question: string;
  label: string;
  run: () => Promise<string>;
}

const listNames = (names: string[]) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * After "make a soulslike collection": offer the owned games that fit it.
 * After rating a game still on Plan to Play: offer to mark it Completed.
 */
export async function followUpOffer(userId: string, intents: { type: string; targets?: { type: string; name: string }[] }[]): Promise<FollowUpOffer | undefined> {
  const uid = new Types.ObjectId(userId);
  const types = new Set(intents.map((i) => i.type));

  if (types.has("CreateCollection") && !types.has("OrganizeCollection")) {
    const name = intents.find((i) => i.type === "CreateCollection")?.targets?.find((t) => t.type === "Collection")?.name;
    // The newest collection is the one just made; its stored name may differ in case from the model's.
    const newest = (await CollectionModel.find({ userId: uid }).sort({ createdAt: -1 }).limit(5).lean()) as any[];
    const col = newest.find((c) => name && c.name.toLowerCase() === name.toLowerCase()) ?? newest[0];
    const style = col ? COLLECTION_STYLES.find(([re]) => re.test(col.name))?.[1] : undefined;
    if (!col || !style || (col.gameIds ?? []).length > 0) return undefined;
    const owned = (await LibraryGame.find({ userId: uid, rawgId: { $exists: true } }).select("_id title rawgId").limit(30).lean()) as any[];
    const facts = await Promise.all(owned.map((g) => rawgService.getGameFacts(g.rawgId)));
    const fits = owned.filter((_, i) => facts[i].tags.includes(style));
    if (fits.length === 0) return undefined;
    const picks = fits.slice(0, 6);
    const titles = picks.map((g) => g.title as string);
    return {
      question: `Want me to add ${listNames(titles)} to it? ${titles.length === 1 ? "It fits" : "They fit"}.`,
      label: `the collection "${col.name}" as it is`,
      run: async () => {
        for (const g of picks) await collectionService.addGameToCollection(userId, String(col._id), String(g._id)).catch(() => undefined);
        return `I've added ${listNames(titles)} to your collection "${col.name}".`;
      },
    };
  }

  const changesStatus = ["SetStatus", "CompleteGame", "StartGame", "PauseGame", "DropGame"].some((t) => types.has(t));
  const rated = intents.filter((i) => i.type === "RateGame" || i.type === "ReviewGame");
  if (rated.length === 1 && !changesStatus) {
    const title = rated[0].targets?.find((t) => t.type === "Game" || t.type === "Library")?.name;
    const game = title ? ((await LibraryGame.findOne({ userId: uid, title }).select("_id title progressStatus").lean()) as any) : null;
    if (!game || !["plan", "none", undefined, null].includes(game.progressStatus)) return undefined;
    return {
      question: `It's still on Plan to Play. Want me to mark ${game.title} as Completed?`,
      label: `${game.title} as it is`,
      run: async () => {
        await libraryToolService.updateStatus(userId, String(game._id), "completed");
        return `I've marked ${game.title} as Completed.`;
      },
    };
  }
  return undefined;
}
