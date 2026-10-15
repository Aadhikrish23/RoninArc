import type { Exchange } from "./RecentExchanges";

/** Follow-ups to the assistant's last reply, and telling a read from a write. No database access. */
export const ACTION = /\b(add|put|mark|set|remove|delete|rate|pause|drop|launch|yeet|move|take|save|write down|jot)\b/i;
export const NOTES_READ = /\b(read|show|list|see|what|whats|what's|any|my|did i (write|leave|add|make|take))\b[^.?!]*\bnotes?\b/i;
/** "add a note to hades: ...", "note: ...", "note that ..." write a note. */
export const NOTE_WRITE = /\b(add|write|save|make|take|leave|jot)\b (a |an |this |the |another )?note\b|\bnotes?\s*:|\bnote (that|down|to self)\b/i;

/** Does the message ask to read notes (so it must never be saved as one)? */
export const asksToReadNotes = (message: string) => NOTES_READ.test(message) && !NOTE_WRITE.test(message);

const ORDINALS: Record<string, number> = {
  first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, fifth: 5, "5th": 5,
};
const ORDINAL_REF = /\b(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)\s+(one|game|pick)\b|\b(?:number|#)\s*([1-5])\b/i;

/** Titles of the bulleted list in the assistant's last reply ("- **Hades**: ..."). */
function listedTitles(reply: string): string[] {
  return reply
    .split("\n")
    .map((line) => line.match(/^\s*(?:-|\*|\d+\.)\s+\*\*(.+?)\*\*/)?.[1])
    .filter((t): t is string => !!t);
}

/** "add the second one" right after a list of picks -> "add <that game>". */
export function resolveOrdinals(message: string, last?: Exchange): string {
  if (!last) return message;
  const match = message.match(ORDINAL_REF);
  if (!match) return message;
  const titles = listedTitles(last.assistant);
  const index = match[3] ? Number(match[3]) : ORDINALS[match[1].toLowerCase()];
  const title = titles[index - 1];
  return title ? message.replace(match[0], title) : message;
}

const WAS_RECOMMENDATION = /New to discover:|From your backlog, I'd play next|I don't have any recommendations matching/;
const REFINEMENT =
  /\b(shorter|short|longer|long|hours?|hrs?|h\b|rogue-?(like|lite)s?|metroidvania|souls-?like|co-?op|cozy|cosy|chill|story|open[- ]world|horror|turn[- ]based|jrpg|cheaper|instead|other|different|else|nah|nope|massive|huge|too (long|big|short)|something)\b/i;

/**
 * "nah those are massive games, i mean a roguelike i can finish in 10-15 hours" right after a
 * recommendation refines it. Returns the combined ask, or undefined when it isn't a refinement.
 */
export function recommendationFollowUp(message: string, last?: Exchange): string | undefined {
  if (!last || !WAS_RECOMMENDATION.test(last.assistant)) return undefined;
  if (ACTION.test(message) || !REFINEMENT.test(message)) return undefined;
  // "massive"/"huge" here complain about the last picks; they don't ask for long games.
  const cleaned = message.replace(/\b(those|these|they)( are|'re)? (massive|huge|big|too long)( games)?\b/gi, "shorter");
  return `${last.user} ${cleaned}`;
}

// ---- Things the assistant can't do yet: say so and change nothing. ----
// (The model turned "remind me friday to play bg3" into "mark BG3 as Playing".)
const REMINDER = /\b(remind|reminder|reminders|alarm|notify|notification|alert me|ping me|schedule|calendar)\b/i;
const UNDO = /\b(undo|revert|take (that|it) back|reverse that)\b/i;

export function unsupportedReply(message: string): string | undefined {
  if (REMINDER.test(message)) {
    return "I can't set reminders yet, so I didn't change anything. If you like, I can put the game in your backlog as Plan to Play so it's waiting for you.";
  }
  if (UNDO.test(message)) {
    return "I can't undo changes yet, so nothing changed. Tell me what to set back, like \"rate Dead Cells 7\" or \"mark it as Plan to Play\".";
  }
  return undefined;
}

// ---- Collection commands the planner has no tool for. ----
export type CollectionCommand =
  | { kind: "delete"; name?: string }
  | { kind: "rename"; name?: string; newName: string };

/** "delete that collection", "remove the whole list called Outer Wilds", "delete my soulslikes collection" (not "remove X from ..."). */
const DELETE_COLLECTION =
  /\b(delete|remove|get rid of|trash|scrap)\s+(?:(?:the|that|this|my|whole|entire)\s+)*(?:(?:collection|list)\b|[\w' -]{1,40}?\s+(?:collection|list)\b)/i;
const RENAME_COLLECTION = /\brename\s+(?:the\s+|my\s+|that\s+|this\s+)?(?:collection\s+|list\s+)?(?:called\s+|named\s+)?["']?(.*?)["']?\s+(?:collection\s+|list\s+)?to\s+["']?(.+?)["']?\s*[.!?]*$/i;

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The collection a message names; "soulslike" also names "Soulslikes". */
export function namedCollection(message: string, collections: string[]): string | undefined {
  const text = ` ${squash(message)} `;
  return collections
    .filter((c) => {
      const name = squash(c);
      return name && (text.includes(` ${name} `) || text.includes(` ${name}s `) || (name.endsWith("s") && text.includes(` ${name.slice(0, -1)} `)));
    })
    .sort((a, b) => b.length - a.length)[0];
}

/** The last collection the assistant talked about ('your collection "Outer Wilds"'), for "that collection". */
export function lastMentionedCollection(exchanges: Exchange[], collections: string[]): string | undefined {
  for (let i = exchanges.length - 1; i >= 0; i--) {
    const names = [...exchanges[i].assistant.matchAll(/collection "([^"]+)"/g)].map((m) => m[1]);
    const found = names.reverse().find((n) => collections.some((c) => c.toLowerCase() === n.toLowerCase()));
    if (found) return collections.find((c) => c.toLowerCase() === found.toLowerCase());
  }
  return undefined;
}

export function parseCollectionCommand(message: string, collections: string[], exchanges: Exchange[], pageCollection?: string): CollectionCommand | undefined {
  const rename = message.match(RENAME_COLLECTION);
  if (rename) {
    const pointsBack = !rename[1].trim() || /\b(that|this|it)\b/i.test(rename[1]);
    const from = namedCollection(rename[1], collections) ?? (pointsBack ? pageCollection ?? lastMentionedCollection(exchanges, collections) : undefined);
    if (from || /\b(collection|list)\b/i.test(message)) return { kind: "rename", name: from, newName: rename[2].trim() };
  }
  if (!DELETE_COLLECTION.test(message) || /\bfrom\b/i.test(message)) return undefined;
  const name =
    namedCollection(message, collections) ??
    (/\b(that|this|the)\s+(whole\s+|entire\s+)?(collection|list)\b/i.test(message) ? pageCollection ?? lastMentionedCollection(exchanges, collections) : undefined) ??
    (collections.length === 1 ? collections[0] : undefined);
  return { kind: "delete", name };
}

// ---- Changes the model planned that the message never asked for. ----
const STATUS_WORDS =
  /\b(play\w*|start\w*|began|begun|finish\w*|beat\w*|complete\w*|complted|done|paus\w*|break|on hold|drop\w*|quit\w*|gave up|giving up|abandon\w*|plan\w*|backlog|status|mark\w*|set|move|100%|platinum\w*|credits)\b/i;
const RATE_WORDS = /\b(rat\w*|scor\w*|review\w*|stars?|out of|give it|giving it|gave it|\d+(\.\d)?)\b|\/\s*10/i;
const COLLECTION_WORDS = /\b(collection\w*|list|folder|group|shelf|put|throw|chuck|toss|stick|in there|into|add\w*|move|organi[sz]e|remove|take|out|from)\b/i;
const NOTE_WORDS = /\b(note\w*|jot|write (it )?down|remember|memo)\b/i;

const ASKED_BY: Record<string, RegExp> = {
  SetStatus: STATUS_WORDS,
  CompleteGame: STATUS_WORDS,
  StartGame: STATUS_WORDS,
  PauseGame: STATUS_WORDS,
  DropGame: STATUS_WORDS,
  RateGame: RATE_WORDS,
  ReviewGame: RATE_WORDS,
  CreateCollection: COLLECTION_WORDS,
  OrganizeCollection: COLLECTION_WORDS,
  AddNote: NOTE_WORDS,
};

/** Does the message ask for this kind of change at all? ("add a note on that one" asks for no status change.) */
export function wasAskedFor(intentType: string, message: string): boolean {
  const words = Object.prototype.hasOwnProperty.call(ASKED_BY, intentType) ? ASKED_BY[intentType] : undefined;
  return !words || words.test(message);
}

// ---- Questions are never commands. ----
// ("should i play elden ring or sekiro first" set Elden Ring to Playing.)
const QUESTION_FORM =
  /^(?:(?:hey|yo|ok|okay|so|hmm|btw|also|wait|honestly)[,!]?\s+)*(should|shall|is|are|was|were|which|what|whats|what's|how|do|does|did|would i|could i|can i|will i|why|who|when|where|any)\b/i;
/** "can you add hades", "please mark it done" are requests, even phrased as questions. */
const REQUEST_FORM = /^(?:(?:hey|yo|ok|okay|so)[,!]?\s+)*(can|could|would|will) (you|u)\b|\b(please|pls|plz)\b/i;
const THEN_DO = /\b(and|also|then|so)\s+(add|put|mark|set|remove|delete|rate|pause|drop|start|move)\b/i;

export const isQuestionOnly = (message: string) =>
  QUESTION_FORM.test(message.trim()) && !REQUEST_FORM.test(message) && !THEN_DO.test(message);

/** "is this worth playing?", "is outer wilds any good?" want an opinion, not a library readout. */
const WORTH = /\b(worth (it|playing|buying|getting|the money|my time|a try|starting)|any good|is (it|this|that)( one| game)? good|hype)\b/i;
/** "elden ring or sekiro first?", "which one is harder": comparisons want an opinion too. */
const COMPARE = /\bor\b[^?.!]*\b(first|next|better|harder|easier|instead)\b|\b(first|better|harder|easier)\b[^?.!]*\bor\b|\bwhich (one|game)\b/i;
export const asksForOpinion = (message: string) => (WORTH.test(message) || COMPARE.test(message)) && isQuestionOnly(message);

/** "drop gta 5 its mid" means the Dropped status; removing from the library needs removal words. */
const DROP_WORDS = /\b(drop|dropp\w*|droppin)\b/i;
const LIBRARY_REMOVAL = /\b(remove|delete|get rid|yeet|uninstall|off my (list|library)|from my (list|library)|out of my (list|library))\b/i;
export const meansDroppedStatus = (message: string) => DROP_WORDS.test(message) && !LIBRARY_REMOVAL.test(message);

/** "is this one worth it?" on Outer Wilds' page -> "is Outer Wilds worth it?" */
export function withPageGame(message: string, pageGame?: string | null): string {
  if (!pageGame) return message;
  return message.replace(/\b(this one|this game|this)\b/i, pageGame);
}

/** Whether a collection message adds or takes out -- the model once reported "removed" for "put ds3 in there". */
const COLLECTION_ADD = /\b(put|add|throw|chuck|toss|stick|include|in there|into)\b/i;
const COLLECTION_REMOVE = /\b(remove|take|pull|delete|kick|drop)\b[^.?!]*\b(out|from|off)\b|\b(remove|take out|pull out)\b/i;
export function collectionDirection(message: string): "add" | "remove" | undefined {
  const add = COLLECTION_ADD.test(message);
  const remove = COLLECTION_REMOVE.test(message);
  if (add && !remove) return "add";
  if (remove && !add) return "remove";
  return undefined;
}

/** "throw sekiro n elden ring in too" -> "... sekiro and elden ring ..." */
export const normalizeSlang = (message: string) =>
  message.replace(/\s+(n|&|\+)\s+/gi, " and ").replace(/\bu\b/gi, "you").replace(/\bpls\b|\bplz\b/gi, "please");

/**
 * "add gta 5", "i own hades": a plain add needs no planner (the model once looped on its own
 * earlier replies and failed "add gta 5" twice). Anything more ("to soulslikes", "and mark it
 * completed", "as playing") still goes through the planner.
 */
const SIMPLE_ADD = /^(?:(?:pls|please|yo|ok|okay|also)[,!]?\s+)*(?:add|i (?:own|have|got|bought))\s+(.+?)(?:\s+to my (?:library|list|games))?\s*[.!]*$/i;
const NOT_A_TITLE = /\b(and|also|then|as|mark|rate|to|into|in there|note|collection|list|review|status|playing|completed|finished|dropped|paused)\b|[,;:?]/i;

export function simpleAddTitle(message: string): string | undefined {
  const match = message.trim().match(SIMPLE_ADD);
  if (!match) return undefined;
  const title = match[1].trim();
  if (!title || title.length > 60 || NOT_A_TITLE.test(title) || /^(a|an|the|some|it|that|this|them)\b/i.test(title)) return undefined;
  return title;
}

/**
 * "change my review on it to: gorgeous and brutal. keep the 9" -> new text, same score.
 * (The model read the review back instead of changing it.)
 */
const REVIEW_EDIT = /\b(?:change|update|edit|replace|rewrite|set)\s+(?:my\s+|the\s+)?review\b(.*?)\bto\b\s*:?\s*["']?(.+?)["']?\s*$/i;

export function parseReviewEdit(message: string): { target: string; text: string; rating?: number } | undefined {
  const match = message.trim().match(REVIEW_EDIT);
  if (!match) return undefined;
  let text = match[2].trim();
  // "... keep the 9" / "... and make it a 9" at the end is about the score, not part of the text.
  let rating: number | undefined;
  const score = text.match(/[.,;]?\s*(?:and\s+)?(?:keep|make it|give it|rate it)\s+(?:the\s+|a\s+|an\s+)?(\d+(?:\.5)?)(?:\s*\/\s*10)?\s*[.!]*$/i);
  if (score) {
    if (/\b(make it|give it|rate it)\b/i.test(score[0])) rating = Number(score[1]);
    text = text.slice(0, score.index).trim();
  }
  text = text.replace(/^["']|["']$/g, "").trim();
  if (!text) return undefined;
  return { target: match[1].trim(), text, rating };
}
