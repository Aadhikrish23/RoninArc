import { Types } from "mongoose";
import CollectionModel from "../../collection/CollectionModel";
import Note from "../../notes/Notemodel";
import LibraryGame from "../../library/LibraryGame";
import { mentions } from "./TargetGrounding";
import { ACTION, NOTES_READ, NOTE_WRITE } from "./FollowUps";

/**
 * Questions about what the user has written down -- "what's in cozy nights?",
 * "read me my notes for this game" -- are answered straight from the data.
 * The model guessed at these (it invented a game called Cozy Nights, and saved
 * "read me my notes" as a new note).
 */

const COLLECTION_CONTENTS = /\b(what'?s in|whats in|what is in|what are in|what games are in|what do i have in|games in|show( me)?|list)\b/i;
const PAGE_REF = /\b(this game|this one|here)\b/i;
const IT_REF = /\b(it|its|that game|that one)\b/i;

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export interface DirectAnswerContext {
  userId: string;
  collections: string[];
  /** Library titles, newest first. */
  owned: string[];
  pageGame?: string;
  pageCollection?: string;
  currentGame?: string | null;
}

/** "whats in soulslikes? and did i write any notes on hollow knight" -> two questions. */
function splitQuestions(message: string): string[] {
  return message
    .split(/\?+|\s+(?:and|also|plus)\s+(?=(?:did|do|what|whats|what's|how|is|are|any|show|read|list|tell)\b)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function describeCollection(question: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  if (!COLLECTION_CONTENTS.test(question) || ACTION.test(question)) return undefined;
  const text = ` ${squash(question)} `;
  // "soulslikes" names the collection "Soulslikes"; so does "soulslike".
  const named = ctx.collections
    .filter((c) => {
      const name = squash(c);
      return name && (text.includes(` ${name} `) || text.includes(` ${name}s `) || (name.endsWith("s") && text.includes(` ${name.slice(0, -1)} `)));
    })
    .sort((a, b) => b.length - a.length)[0];
  const name = named ?? (ctx.pageCollection && /\bthis (collection|list|one)\b|\bhere\b/i.test(question) ? ctx.pageCollection : undefined);
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
  if (!NOTES_READ.test(question) || NOTE_WRITE.test(question)) return undefined;
  const named = ctx.owned.filter((t) => mentions(question, t)).sort((a, b) => b.length - a.length)[0];
  const title =
    named ??
    (ctx.pageGame && PAGE_REF.test(question) ? ctx.pageGame : undefined) ??
    (ctx.currentGame && (IT_REF.test(question) || PAGE_REF.test(question)) ? ctx.currentGame : undefined);
  if (!title) return undefined;
  const uid = new Types.ObjectId(ctx.userId);
  const game = (await LibraryGame.findOne({ userId: uid, title }).select("_id title").lean()) as any;
  if (!game) return undefined;
  const notes = await Note.find({ userId: uid, gameId: game._id }).sort({ createdAt: -1 }).lean();
  if (notes.length === 0) return `You haven't written any notes on ${game.title} yet.`;
  const list = notes.map((n: any) => `- ${n.content}`).join("\n");
  return `Your ${notes.length === 1 ? "note" : `${notes.length} notes`} on ${game.title}:\n${list}`;
}

/** Answers the message from the data when every question in it can be; otherwise undefined. */
export async function answerDirectly(message: string, ctx: DirectAnswerContext): Promise<string | undefined> {
  const questions = splitQuestions(message);
  if (questions.length === 0 || questions.length > 3) return undefined;
  const answers: string[] = [];
  for (const q of questions) {
    const answer = (await describeCollection(q, ctx)) ?? (await describeNotes(q, ctx));
    if (!answer) return undefined;
    answers.push(answer);
  }
  return answers.join("\n\n");
}


