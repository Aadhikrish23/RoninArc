import type { Exchange } from "../../../conversation/RecentExchanges";

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
const BUY = /\b(buy|purchase|order|pre-?order|gift)\b/i;
const WHOLE_LIBRARY =
  /\b(nuke|wipe|clear|delete|remove|reset|empty)\b[^.?!]*\b(whole|entire|all( of)?( my)?|everything in)\s+(my\s+)?(library|games)\b|\b(start|starting) (fresh|over|from scratch)\b/i;

export function unsupportedReply(message: string): string | undefined {
  // "remind me friday ... and also buy silksong": answer every part it can't do, not just the first.
  // (A plain "buy X" goes to the model, whose reply offers to add X instead.)
  const cant: string[] = [];
  // "nuke my whole library": too much to do (or undo) from one chat message.
  if (WHOLE_LIBRARY.test(message)) {
    return "I can't clear your whole library from chat, so nothing changed. You can remove games one at a time (\"remove hades\"), or from the All Games page.";
  }
  if (REMINDER.test(message)) cant.push("set reminders");
  if (cant.length > 0 && BUY.test(message)) cant.push("buy games");
  if (cant.length > 0) {
    return `I can't ${cant.join(" or ")} yet, so I didn't change anything. Tell me if you want a game added to your backlog instead.`;
  }
  if (UNDO.test(message)) {
    return "There's nothing I can undo right now, so nothing changed. I can undo the last status, rating, note, added game or removal from the past 30 minutes. Name the game to reach further back, like \"undo the hades change\". Collection changes can't be undone, but you can just say the opposite (\"take it out of that collection\").";
  }
  return undefined;
}

// ---- Collection commands the planner has no tool for. ----
export type CollectionCommand =
  | { kind: "delete"; name?: string }
  | { kind: "rename"; name?: string; newName: string; rest?: string };

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
      // "Soulslike Collection" is also "the soulslike list".
      const name = squash(c).replace(/\s+(collection|list)$/, "");
      return name && (text.includes(` ${name} `) || text.includes(` ${name}s `) || (name.endsWith("s") && text.includes(` ${name.slice(0, -1)} `)));
    })
    .sort((a, b) => b.length - a.length)[0];
}

/** The last collection the assistant talked about ('your collection "Outer Wilds"'), for "that collection". */
export function lastMentionedCollection(exchanges: Exchange[], collections: string[]): string | undefined {
  for (let i = exchanges.length - 1; i >= 0; i--) {
    // Any quoted name that is a collection: 'renamed the collection "Soulslike" to "Git Gud"' ends on the new name.
    // Bold counts too: "**Soulslikes** has 2 games" (the collection-contents answer) is about Soulslikes.
    const names = [...exchanges[i].assistant.matchAll(/"([^"]+)"|\*\*([^*]+)\*\*/g)].map((m) => m[1] ?? m[2]);
    const found = names.reverse().find((n) => collections.some((c) => c.toLowerCase() === n.toLowerCase()));
    if (found) return collections.find((c) => c.toLowerCase() === found.toLowerCase());
  }
  return undefined;
}

/**
 * "put ds3 in there" right after talking about Soulslikes -> 'put ds3 in "Soulslikes"': "there" is the
 * collection the conversation was on, so the planner doesn't settle for just adding the game.
 */
export function fillCollectionThere(message: string, exchanges: Exchange[], collections: string[]): string {
  const there = /\b(in|into|to)\s+(there|that one|that collection|that list|the collection)\b/i;
  if (!there.test(message)) return message;
  const collection = lastMentionedCollection(exchanges, collections);
  return collection ? message.replace(there, (_, prep) => `${prep} "${collection}"`) : message;
}

/**
 * "Git Gud and tell me whats in it" -> "Git Gud": the new name stops at a second request;
 * "just Git Gud" -> "Git Gud".
 */
const NAME_STOP = /\s+(?:and also|and then|and|then|also|plus)\s+(?=(?:tell|show|list|what|whats|what's|add|put|remove|delete|mark|rate|get|take|throw|give|gimme|start|pause|drop|set|make|create|move|launch|play|finish|unpause)\b)|[,;]\s+|\.\s+/i;

/** "Git Gud and get rid of cod mw2" -> name "Git Gud", rest "get rid of cod mw2". */
function splitNewName(raw: string): { name: string; rest?: string } {
  const match = raw.match(NAME_STOP);
  const name = (match ? raw.slice(0, match.index) : raw)
    .replace(/^(?:just|simply|only)\s+/i, "")
    .replace(/["'.!?]+$/g, "")
    .trim();
  const rest = match ? raw.slice((match.index ?? 0) + match[0].length).trim() : "";
  return { name, ...(rest.split(/\s+/).length >= 2 ? { rest } : {}) };
}
const cleanNewName = (raw: string) => splitNewName(raw).name;

export function parseCollectionCommand(message: string, collections: string[], exchanges: Exchange[], pageCollection?: string): CollectionCommand | undefined {
  const rename = message.match(RENAME_COLLECTION);
  if (rename) {
    const pointsBack = !rename[1].trim() || /\b(that|this|it)\b/i.test(rename[1]);
    const from = namedCollection(rename[1], collections) ?? (pointsBack ? pageCollection ?? lastMentionedCollection(exchanges, collections) : undefined);
    if (from || /\b(collection|list)\b/i.test(message)) {
      const { name: newName, rest } = splitNewName(rename[2]);
      return { kind: "rename", name: from, newName, ...(rest ? { rest } : {}) };
    }
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
  /\b(play\w*|start\w*|began|begun|finish\w*|beat\w*|complete\w*|complted|done|paus\w*|unpaus\w*|resum\w*|continu\w*|break|on hold|drop\w*|quit\w*|gave up|giving up|abandon\w*|plan\w*|backlog|status|mark\w*|set|move|100%|platinum\w*|credits)\b/i;
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
const REQUEST_FORM = /^(?:(?:hey|yo|ok|okay|so)[,!]?\s+)*(can|could|would|will) (you|u)\b|\b(please|pls|plz|do it|i said)\b/i;
const THEN_DO = /\b(and|also|then|so)\s+(add|put|mark|set|remove|delete|rate|pause|drop|start|move)\b/i;

export const isQuestionOnly = (message: string) =>
  QUESTION_FORM.test(message.trim()) && !REQUEST_FORM.test(message) && !THEN_DO.test(message) && !trailingCommand(message);

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
// "i want dark souls 3 out of soulslike" has no verb, but "out of" says it all.
const COLLECTION_REMOVE = /\b(remove|take|pull|delete|kick|drop)\b[^.?!]*\b(out|from|off)\b|\b(remove|take out|pull out)\b|\bout of\b/i;
export function collectionDirection(message: string): "add" | "remove" | undefined {
  const add = COLLECTION_ADD.test(message);
  const remove = COLLECTION_REMOVE.test(message);
  if (add && !remove) return "add";
  if (remove && !add) return "remove";
  return undefined;
}

/** Common typos of the status words, so "mark stardew as plyaing" is a status change. */
const STATUS_TYPOS: [RegExp, string][] = [
  [/\b(plyaing|palying|playng|plaing|plying)\b/gi, "playing"],
  [/\b(compelted|completd|complted|compleated)\b/gi, "completed"],
  [/\b(pasued|puased|pausd)\b/gi, "paused"],
  [/\b(droped|dorpped)\b/gi, "dropped"],
  [/\b(finsihed|finshed|fnished)\b/gi, "finished"],
];

/** "throw sekiro n elden ring in too" -> "... sekiro and elden ring ..."; "plyaing" -> "playing". */
export const normalizeSlang = (message: string) =>
  STATUS_TYPOS.reduce(
    (text, [re, word]) => text.replace(re, word),
    message.replace(/\s+(n|&|\+)\s+/gi, " and ").replace(/\bu\b/gi, "you").replace(/\bpls\b|\bplz\b/gi, "please"),
  );

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
  const title = withoutPoliteness(match[1]);
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

/** "10/10 masterpiece", "a solid 8 out of 10": a score stated in passing, 1-10 (halves allowed). */
export function statedScore(message: string): number | undefined {
  // "10/10", "9 out of 10", and "finished celeste, its a 9" / "easy 8" (not "2 hours", "100%").
  const match =
    message.match(/\b(\d{1,2}(?:\.5)?)\s*(?:\/|out of)\s*10\b/i) ??
    message.match(/\b(?:it'?s|its|easy|solid|a solid|an easy|strong|gave it|i'?d give it)\s+(?:an?\s+)?(\d{1,2}(?:\.5)?)\b(?!\s*(?:%|h\b|hrs?\b|hours?\b|mins?\b|minutes?\b|th\b|st\b|nd\b|rd\b|times?\b|tries\b|try\b|attempts?\b|runs?\b|goes\b|go\b|days?\b|weeks?\b|months?\b|years?\b|deaths?\b|more\b))/i);
  if (!match) return undefined;
  const score = Number(match[1]);
  return score >= 1 && score <= 10 ? score : undefined;
}

/** "add silksong pls" -> "silksong": politeness isn't part of a title. */
// "add cod mw2 back" -> "cod mw2": politeness and "back"/"again" aren't part of a title.
export const withoutPoliteness = (title: string) => title.replace(/[\s,]+(please|pls|plz|thanks|thx|ty|back|again|too)[.!]*$/i, "").trim();

// ---- Plain single commands, parsed without the model (it can take a minute to answer). ----
export type QuickCommand =
  | { kind: "rate"; game: string; rating: number; comment?: string }
  | { kind: "status"; game: string; status: string }
  | { kind: "note"; game: string; text: string };

const STATUS_VERBS: Record<string, string> = {
  pause: "paused", paused: "paused",
  drop: "dropped", dropped: "dropped",
  start: "playing", started: "playing", starting: "playing",
  unpause: "playing", resume: "playing", continue: "playing",
  finish: "completed", finished: "completed", complete: "completed", completed: "completed", beat: "completed",
};
const STATUS_WORDS_AS: Record<string, string> = {
  playing: "playing", paused: "paused", completed: "completed", done: "completed", finished: "completed",
  beaten: "completed", dropped: "dropped", "plan to play": "plan", planned: "plan", backlog: "plan",
};
/** Where the game name stops: "pause rdr2 im taking a break" -> "rdr2". */
const NAME_END = /[,.!;:?]|\s+(?:im|i'm|i am|its|it's|it is|because|cuz|coz|since|lol|lmao|tho|bc|for now|rn|right now|already|finally|last night|yesterday|today|tonight|again)\b/i;
/** A second request in the same message goes to the planner. */
const SECOND_REQUEST =
  /\b(and|also|plus|then)\s+(?:i'?m\s+|im\s+|i\s+)?(add|put|mark|set|remove|delete|rate|pause|drop|start|starting|move|note|give|gimme|gib|take|get|throw|chuck|toss|stick|rename|make|create|finish|finished|unpause|resume)\b|[.;!]\s+(?:(?:ok|and|also|so|then|now)\s+)?(add|put|mark|set|remove|delete|rate|pause|drop|start|move|note|give|gimme|gib|take|get|throw|rename|make|create)\b/i;

const cutName = (text: string) => text.split(NAME_END)[0].trim();
/** "ok, and ...", "so ...", "now ..." in front of a command. */
const FILLER_START = /^(?:(?:ok|okay|k|and|also|so|then|now|alright|pls|please|just)[,!.]?\s+)+/i;

/**
 * "how long is disco elysium? thinking of going back to it, unpause it" -> "unpause it":
 * a command tacked on after a question, so the question's answer doesn't swallow it.
 */
export function trailingCommand(message: string): string | undefined {
  const clauses = message.split(/[?!.;,]+\s*/).map((c) => c.trim()).filter(Boolean);
  if (clauses.length < 2) return undefined;
  const last = clauses[clauses.length - 1];
  return parseQuickCommand(last) ? last : undefined;
}

export function parseQuickCommand(message: string): QuickCommand | undefined {
  // "ok, and unpause it?" -> "unpause it"
  const m = message.trim().replace(FILLER_START, "").replace(/[?!.]+$/, "").trim();
  if (SECOND_REQUEST.test(m)) return undefined;

  const note = m.match(/^(?:(?:add|write|leave|make)\s+(?:a\s+)?)?note\s+(?:for|on|to|about)\s+(.+?)\s*:\s*(.+)$/i);
  if (note) return { kind: "note", game: note[1].trim(), text: note[2].trim() };

  // "give witcher 3 a 10" is a 10 for The Witcher 3, not a 3 for "witcher": an explicit "a/an N"
  // wins, then a number at the very end ("rate witcher 3 9"), then the first number.
  const rate =
    m.match(/^(?:rate|give|gimme|gib)\s+(.+?)\s+(?:an?|like an?)\s+(\d{1,2}(?:\.5)?)(?:\s*(?:\/|out of)\s*10)?(?:[\s,.:;!-]+(.+))?$/i) ??
    m.match(/^(?:rate|give|gimme|gib)\s+(.+)\s+(\d{1,2}(?:\.5)?)(?:\s*(?:\/|out of)\s*10)?()\s*$/i) ??
    m.match(/^(?:rate|give|gimme|gib)\s+(.+?)\s+(?:an?\s+)?(\d{1,2}(?:\.5)?)(?:\s*(?:\/|out of)\s*10)?(?:[\s,.:;!-]+(.+))?$/i);
  if (rate) {
    const rating = Number(rate[2]);
    if (rating < 1 || rating > 10) return undefined;
    // "give it an 8 so far, combat is kinda mid": the review is "combat is kinda mid".
    const comment = rate[3]?.replace(/^(?:so far|for now|honestly|tbh|ngl|imo|tho|though|cuz|because|bc|since)\b[\s,:-]*/i, "").trim();
    return { kind: "rate", game: rate[1].trim(), rating, ...(comment ? { comment } : {}) };
  }

  const changeTo = m.match(/^(?:change|set|make|bump|update|drop|lower|raise|knock)\s+(.+?)\s+(?:down\s+|up\s+)?to\s+(?:an?\s+)?(\d{1,2}(?:\.5)?)(?:\s*(?:\/|out of)\s*10)?(?:[\s,.:;!-]+(.+))?$/i);
  if (changeTo) {
    const rating = Number(changeTo[2]);
    if (rating >= 1 && rating <= 10) {
      const comment = changeTo[3]?.replace(/^(actually|tho|though)\b[\s,]*/i, "").trim();
      return { kind: "rate", game: changeTo[1].trim(), rating, ...(comment ? { comment } : {}) };
    }
  }

  const markAs = m.match(/^(?:mark|set|move|put)\s+(.+?)\s+(?:as|to)\s+(playing|paused|completed|done|finished|beaten|dropped|plan to play|planned|backlog)\b/i);
  if (markAs) return { kind: "status", game: markAs[1].trim(), status: STATUS_WORDS_AS[markAs[2].toLowerCase()] };

  const told = m.match(/^(?:i\s+(?:just\s+|finally\s+|have\s+|already\s+)?|just\s+|finally\s+)?(finished|completed|beat|started|dropped|paused)\s+(?:playing\s+|on\s+)?(.+)$/i);
  const imperative = m.match(/^(pause|drop|start|finish|complete|unpause|resume|continue)\s+(?:playing\s+|on\s+)?(.+)$/i);
  const verbMatch = told ?? imperative;
  if (verbMatch) {
    const game = cutName(verbMatch[2]);
    if (!game) return undefined;
    return { kind: "status", game, status: STATUS_VERBS[verbMatch[1].toLowerCase()] };
  }
  return undefined;
}

/**
 * "save that as a note on sekiro but also add 'jump + attack to reverse lightning'": the note is
 * the assistant's last answer (plus the user's addition), not the command itself.
 */
const SAVE_THAT = /\b(save|add|put|keep|write|jot)\s+(that|this|it|those|these|those tips|that tip|that answer)\s+(down\s+)?(as|in|to|into)\s+(a\s+|my\s+)?notes?\b/i;

export function saveThatAsNote(message: string, last?: Exchange): { gameText: string; text: string } | undefined {
  if (!last || !SAVE_THAT.test(message)) return undefined;
  const gameText = message.match(/\bnotes?\s+(?:on|for|about|to)\s+(.+?)(?:\s+(?:but|and|also|plus)\b|[,.;:!?]|$)/i)?.[1]?.trim() ?? "";
  // A quoted addition, or whatever follows "also add".
  const addition = message.match(/["“']([^"”']{3,200})["”']/)?.[1] ?? message.match(/\b(?:also|and)\s+(?:add|put|include)\s*:?\s*(.{3,200})$/i)?.[1];
  const answer = last.assistant.trim();
  if (!answer) return undefined;
  return { gameText, text: addition ? `${answer}\n\n${addition.trim()}` : answer };
}

/**
 * "put it in the soulslike one too, and start playing sekiro": the "it" clause names no game,
 * so "it" is the game the conversation was on -- not Sekiro, named in the other clause.
 * Rewrites that clause's "it" to the referent so the planner can't mix them up.
 */
export function pinPronoun(message: string, referent: string | undefined, nameIn: (text: string) => string | undefined): string {
  const clauses = message.split(/(,\s*|\s+and\s+|\s+also\s+|\s+then\s+)/i);
  if (clauses.filter((_, i) => i % 2 === 0).length < 2) {
    // One clause: "it" points back only when no game is named before it and one is named after
    // ("throw it in the rockstar collection with rdr2 too" lost San Andreas, the game just added).
    const at = message.search(/\b(it|that one)\b/i);
    if (!referent || at < 0 || nameIn(message.slice(0, at)) || !nameIn(message.slice(at))) return message;
    return message.slice(0, at) + message.slice(at).replace(/\b(it|that one)\b/i, referent);
  }
  if (!clauses.some((c, i) => i % 2 === 0 && nameIn(c))) return message;
  // "it" is the nearest game named before it in the message ("beat the witcher, mark it done"),
  // or the conversation's game when nothing came before ("put it in there, and start sekiro").
  let lastNamed: string | undefined;
  return clauses
    .map((c, i) => {
      if (i % 2 === 1) return c;
      const named = nameIn(c);
      if (named) {
        lastNamed = named;
        return c;
      }
      const target = lastNamed ?? referent;
      return target && /\b(it|that one)\b/i.test(c) ? c.replace(/\b(it|that one)\b/i, target) : c;
    })
    .join("");
}

const ACTION_START = /^(?:(?:ok|okay|and|also|so|then|now|pls|please|just)[,!.]?\s+)*(?:i\s+(?:just\s+|finally\s+)?)?(?:rate|give|gimme|gib|finished|completed|beat|started|dropped|paused|pause|drop|start|finish|complete|unpause|resume|continue|mark|set|move|put|add|remove|delete|note)\b/i;

/**
 * "drop cod, mp is dead anyway. give it a 4" -> two commands; "it" is the game before it.
 * Every piece that starts like a command has to parse, or the whole message goes to the planner.
 */
export function parseQuickCommands(message: string): QuickCommand[] | undefined {
  const pieces = message
    .split(/[.;!?]+\s+|,\s+(?=(?:and\s+)?(?:give|gimme|gib|rate|pause|drop|start|unpause|resume|mark|set|note)\b)|\s+and\s+(?=(?:give|gimme|gib|rate|pause|drop|start|unpause|resume|mark|set)\s)/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (pieces.length < 2) return undefined;
  const commands: QuickCommand[] = [];
  for (const piece of pieces) {
    if (!ACTION_START.test(piece)) continue; // "mp is dead anyway"
    const command = parseQuickCommand(piece);
    if (!command) return undefined;
    commands.push(command);
  }
  return commands.length >= 2 ? commands : undefined;
}
