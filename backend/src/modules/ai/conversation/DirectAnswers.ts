import { Types } from "mongoose";
import CollectionModel from "../../collection/CollectionModel";
import Note from "../../notes/Notemodel";
import Review from "../../review/Reviewmodel";
import LibraryGame from "../../library/LibraryGame";
import rawgService from "../../rawg/rawgService";
import { franchiseMatch, namedTitles } from "./TargetGrounding";
import { ACTION, NOTES_READ, NOTE_WRITE, namedCollection } from "./FollowUps";

/**
 * Questions about the user's own data -- "what's in cozy nights?", "read me my
 * notes", "how long is this one?", "any co-op games in my library?" -- are
 * answered straight from the database. The model guessed at these (it invented
 * a game called Cozy Nights, saved "read me my notes" as a note, and answered
 * "how long is this one to beat?" with a list of completed games).
 */

const COLLECTION_CONTENTS = /\b(what'?s in|whats in|what is in|what are in|what games are in|what do i have in|games in|show( me)?|list)\b/i;
const WROTE_ABOUT = /\bwhat did i (write|say|put|think)\b|\bmy (review|thoughts)\b/i;
const PLAYTIME = /\bhow long\b|\bhow many hours\b|\bhours? (to beat|to finish|long)\b|\btime to beat\b|\blength of\b/i;
const FAVOURITE = /\b(fav|fave|favs|faves|favou?rites?|best|top rated|highest rated)\b/i;
const PLAYING_NOW = /\bwhat am i (playing|on)\b|\b(currently|right now|rn) playing\b|\bplaying (rn|right now|now|at the moment|currently)\b/i;
const MY_LIBRARY = /\b(my|mine|i (own|have|got)|in my library|of my)\b/i;
const PAGE_REF = /\b(this game|this one|here|on my screen|i.m looking at|on screen|this page)\b/i;
const IT_REF = /\b(it|its|that game|that one)\b/i;
const QUESTION_START = /^(what|whats|what's|how|is|are|do|did|does|can|could|should|would|which|who|when|where|why|any|show|list|tell|read)\b/i;
const EASY =/\b(easy|easier|not (into |a fan of )?(hard|difficult)|chill|casual|relaxing|beginner|cozy|cosy)\b/i;

/** Play features players ask about, as RAWG tag slugs. */
const FEATURES: [RegExp, string, string[]][] = [
  [/\b(co-?op|coop|cooperative|play with (my|a) (friend|gf|bf|partner|wife|husband))\b/i, "co-op", ["co-op", "cooperative", "online-co-op", "local-co-op", "split-screen"]],
  [/\b(multiplayer|multi-player|pvp|online)\b/i, "multiplayer", ["multiplayer", "online-multiplayer", "online-pvp", "pvp", "massively-multiplayer"]],
  [/\b(split[- ]?screen|couch)\b/i, "split-screen", ["split-screen", "local-co-op", "local-multiplayer"]],
  [/\b(single[- ]?player|solo)\b/i, "single-player", ["singleplayer"]],
];

const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);

export interface DirectAnswerContext {
  userId: string;
  collections: string[];
  /** Library titles, newest first. */
  owned: string[];
  pageGame?: string;
  pageCollection?: string;
  currentGame?: string | null;
}

/** The library game a question is about: named, shorthand, the page, or "it". */
export function gameFor(question: string, ctx: DirectAnswerContext): string | undefined {
  return (
    namedTitles(question, ctx.owned)[0] ??
    franchiseMatch(question, ctx.owned) ??
    (ctx.pageGame && PAGE_REF.test(question) ? ctx.pageGame : undefined) ??
    (ctx.currentGame && (IT_REF.test(question) || PAGE_REF.test(question)) ? ctx.currentGame : undefined)
  );
}

const libraryGame = (userId: string, title: string) =>
  LibraryGame.findOne({ userId: new Types.ObjectId(userId), title }).lean() as Promise<any>;

async function describeCollection(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  if (!COLLECTION_CONTENTS.test(question) || ACTION.test(question)) return undefined;
  const name =
    namedCollection(question, ctx.collections) ??
    (ctx.pageCollection && /\bthis (collection|list|one)\b|\bhere\b/i.test(question) ? ctx.pageCollection : undefined);
  if (!name) return undefined;
  const col = await CollectionModel.findOne({ userId: new Types.ObjectId(ctx.userId), name })
    .populate<{ gameIds: { title: string }[] }>({ path: "gameIds", select: "title" })
    .lean();
  if (!col) return undefined;
  const titles = (col.gameIds ?? []).map((g: any) => g?.title).filter(Boolean) as string[];
  if (titles.length === 0) return `**${col.name}** is empty right now.`;
  const list = titles.map((t) => `- ${t}`).join("\n");
  return `**${col.name}** has ${titles.length} ${titles.length === 1 ? "game" : "games"}:\n${list}`;
}

async function describeNotes(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  const aboutWriting = WROTE_ABOUT.test(question);
  if (!(NOTES_READ.test(question) || aboutWriting) || NOTE_WRITE.test(question)) return undefined;
  const title = gameFor(question, ctx);
  if (!title) return undefined;
  const game = await libraryGame(ctx.userId, title);
  if (!game) return undefined;
  const uid = new Types.ObjectId(ctx.userId);
  const [notes, review] = await Promise.all([
    Note.find({ userId: uid, gameId: game._id }).sort({ createdAt: -1 }).lean(),
    // "what did I write about X" covers the review too.
    aboutWriting || /\breview\b/i.test(question) ? Review.findOne({ userId: uid, gameId: game._id }).lean() : null,
  ]);
  const parts: string[] = [];
  if (review) {
    const r = review as any;
    parts.push(`Your review of ${game.title}: ${r.rating}/10${r.reviewText ? ` -- "${r.reviewText}"` : ""}`);
  }
  if (notes.length > 0) {
    parts.push(`Your ${notes.length === 1 ? "note" : `${notes.length} notes`} on ${game.title}:\n${notes.map((n: any) => `- ${n.content}`).join("\n")}`);
  }
  if (parts.length === 0) {
    return aboutWriting
      ? `You haven't written a review or any notes on ${game.title} yet.`
      : `You haven't written any notes on ${game.title} yet.`;
  }
  return parts.join("\n\n");
}

async function describePlaytime(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  if (!PLAYTIME.test(question)) return undefined;
  const title = gameFor(question, ctx);
  if (!title) return undefined;
  const game = await libraryGame(ctx.userId, title);
  if (!game) return undefined;
  // The library copy is filled in by background enrichment; ask RAWG if it isn't there yet.
  const hours = typeof game.playtime === "number" && game.playtime > 0 ? game.playtime : game.rawgId ? (await factsOf(game.rawgId)).playtime : 0;
  // RAWG's average is unreliable below a few hours (few players logged it).
  if (hours < 3) return `I don't have a reliable playtime for ${game.title}, sorry.`;
  return `Players spend about ${hours} hours on ${game.title} on average (RAWG's playtime average, so a focused run can be shorter).`;
}

const factCache = new Map<number, { tags: string[]; playtime: number }>();
async function factsOf(rawgId: number) {
  if (!factCache.has(rawgId)) factCache.set(rawgId, await rawgService.getGameFacts(rawgId));
  return factCache.get(rawgId)!;
}
const tagsOf = async (rawgId: number) => (await factsOf(rawgId)).tags;

async function describeFeature(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  const feature = FEATURES.find(([re]) => re.test(question));
  if (!feature || !MY_LIBRARY.test(question) || ACTION.test(question)) return undefined;
  const [, label, slugs] = feature;
  const games = (await LibraryGame.find({ userId: new Types.ObjectId(ctx.userId), rawgId: { $exists: true } })
    .select("title rawgId progressStatus")
    .limit(60)
    .lean()) as any[];
  const tagged = await Promise.all(games.map(async (g) => ({ title: g.title as string, status: g.progressStatus, tags: await tagsOf(g.rawgId) })));
  let matches = tagged.filter((g) => g.tags.some((t) => slugs.includes(t)) && g.status !== "dropped");
  const easy = EASY.test(question);
  if (easy) matches = matches.filter((g) => !g.tags.some((t) => ["difficult", "souls-like", "hard"].includes(t)));
  if (matches.length === 0) {
    return `None of your games are tagged ${label}${easy ? " (leaving out the hard ones)" : ""}. Want me to suggest some?`;
  }
  const list = matches.slice(0, 10).map((g) => `- ${g.title}`).join("\n");
  return `${easy ? "Laid-back games" : "Games"} in your library with ${label}:\n${list}`;
}

async function describeFavourite(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  if (!FAVOURITE.test(question) || !MY_LIBRARY.test(question) || ACTION.test(question) || /\b(like|similar|recommend|suggest)\b/i.test(question)) return undefined;
  const reviews = (await Review.find({ userId: new Types.ObjectId(ctx.userId) }).sort({ rating: -1, updatedAt: -1 }).limit(3).populate("gameId", "title").lean()) as any[];
  const rated = reviews.filter((r) => r.gameId?.title);
  if (rated.length === 0) return "You haven't rated anything yet, so I can't tell your favourite. Try \"rate Hades 9\".";
  const [top, ...rest] = rated;
  const runnersUp = rest.length ? ` Next up: ${rest.map((r) => `${r.gameId.title} (${r.rating}/10)`).join(", ")}.` : "";
  return `Your favourite so far is ${top.gameId.title}, rated ${top.rating}/10.${runnersUp}`;
}

async function describePlaying(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  if (!PLAYING_NOW.test(question)) return undefined;
  const playing = (await LibraryGame.find({ userId: new Types.ObjectId(ctx.userId), progressStatus: "playing" }).select("title").lean()) as any[];
  if (playing.length === 0) return "Nothing is marked Playing right now.";
  return `You're playing ${playing.map((g) => g.title).join(", ")}.`;
}

const COUNT_STATUSES: [RegExp, string, string][] = [
  [/\b(finish\w*|beat\w*|complete\w*|done)\b/i, "completed", "finished"],
  [/\b(playing|in progress|on the go)\b/i, "playing", "playing"],
  [/\b(paus\w*|on hold|break)\b/i, "paused", "paused"],
  [/\b(drop\w*|abandon\w*|gave up)\b/i, "dropped", "dropped"],
  [/\b(backlog|to play|planned|plan to play|left)\b/i, "backlog", "in your backlog"],
];

async function describeCounts(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  if (!/\bhow many\b/i.test(question) || ACTION.test(question)) return undefined;
  const games = (await LibraryGame.find({ userId: new Types.ObjectId(ctx.userId) }).select("progressStatus").lean()) as any[];
  const count = (status: string) =>
    status === "backlog"
      ? games.filter((g) => ["plan", "playing", "paused"].includes(g.progressStatus)).length
      : games.filter((g) => g.progressStatus === status).length;
  const asked = COUNT_STATUSES.filter(([re]) => re.test(question));
  const plural = (n: number) => `${n} ${n === 1 ? "game" : "games"}`;
  // "how many games do i have (and how many have i finished)": the whole breakdown covers it.
  if (/\bhow many games\b|\b(total|in total|altogether|overall)\b/i.test(question)) {
    const breakdown = (
      [["playing", "playing"], ["paused", "paused"], ["plan", "plan to play"], ["completed", "completed"], ["dropped", "dropped"], ["none", "no status"]] as const
    )
      .map(([status, label]) => [games.filter((g) => (g.progressStatus || "none") === status).length, label] as const)
      .filter(([n]) => n > 0)
      .map(([n, label]) => `${n} ${label}`);
    return `You have ${plural(games.length)}: ${breakdown.join(", ")}.`;
  }
  if (asked.length === 0) return undefined;
  const parts = asked.map(([, status, label]) => `${plural(count(status))} ${label}`);
  return `You have ${parts.join(", ")}, out of ${plural(games.length)} in your library.`;
}

async function describeAverage(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  if (!/\b(average|avg|mean)\b[^.?!]*\b(rating|score)s?\b/i.test(question) || PLAYTIME.test(question)) return undefined;
  const reviews = (await Review.find({ userId: new Types.ObjectId(ctx.userId) }).select("rating").lean()) as any[];
  if (reviews.length === 0) return "You haven't rated any games yet.";
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return `Your average rating is ${avg.toFixed(1)}/10 across ${reviews.length} rated ${reviews.length === 1 ? "game" : "games"}.`;
}

const RATING_ASK = /\bwhat (did|have) i (rate|rated|give|gave|score|scored)\b|\bwhat rating\b|\bmy (rating|score) (for|of|on)\b|\bhow did i rate\b/i;

/** "what did I rate this one again?" on Stardew's page: the user's own score, not a library summary. */
async function describeRating(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  if (!RATING_ASK.test(question)) return undefined;
  const title = gameFor(question, ctx) ?? ctx.pageGame ?? undefined;
  if (!title) return undefined;
  const game = await libraryGame(ctx.userId, title);
  if (!game) return undefined;
  const review = (await Review.findOne({ userId: new Types.ObjectId(ctx.userId), gameId: game._id }).lean()) as any;
  if (!review) return `You haven't rated ${game.title} yet.`;
  return `You rated ${game.title} ${review.rating}/10${review.reviewText ? ` -- "${review.reviewText}"` : "."}`;
}

const HANDLERS = [describeRating, describeCollection, describeNotes, describePlaytime, describeFeature, describeAverage, describeFavourite, describePlaying, describeCounts];

async function answerOne(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  for (const handler of HANDLERS) {
    const answer = await handler(question, ctx);
    if (answer) return answer;
  }
  return undefined;
}

/** "whats in soulslikes? and did i write any notes on hollow knight" -> two questions. */
function splitQuestions(message: string): string[] {
  return message
    .split(/\?+|\s+(?:and|also|plus)\s+(?=(?:did|do|what|whats|what's|how|is|are|any|show|read|list|tell|which)\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Answers the message from the data when every question in it can be; otherwise undefined. */
export interface DirectAnswer {
  /** Everything answered from the data. */
  answer?: string;
  /** Some questions answered; these others are for the model ("is it on steam deck?"). */
  partial?: { answers: string[]; rest: string[] };
}

export async function answerDirectly(message: string, ctx: DirectAnswerContext): Promise<DirectAnswer> {
  const questions = splitQuestions(message);
  if (questions.length > 3) return {};
  const answers: string[] = [];
  const unanswered: string[] = [];
  if (questions.length >= 2) {
    for (const q of questions) {
      const answer = await answerOne(q, ctx);
      if (answer) answers.push(answer);
      else unanswered.push(q);
    }
    if (unanswered.length === 0) return { answer: answers.join("\n\n") };
  }
  // One question, or a fragment that only makes sense with the rest ("what did i write about gta? any notes?").
  // ("she's not into hard stuff" isn't a question; it qualifies the one before it.)
  const realQuestions = unanswered.filter((q) => words(q).length > 3 && QUESTION_START.test(q));
  if (realQuestions.length > 0) {
    // A real second question we can't answer goes to the model instead of being dropped.
    return answers.length > 0 ? { partial: { answers, rest: unanswered } } : {};
  }
  const answer = await answerOne(message, ctx);
  return answer ? { answer } : {};
}
