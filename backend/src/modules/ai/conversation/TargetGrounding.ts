import { IntentPlan } from "../intent/IntentPlan";
import { IntentType } from "../intent/IntentType";
import { IntentTargetType } from "../intent/IntentTargetType";
import { titleMatchScore } from "../../rawg/titleMatch";
import { expandAbbreviation } from "../../rawg/gameAbbreviations";

/**
 * The model sometimes acts on a game the user never mentioned: "asdfgh" became
 * "mark Hades II as Playing", "finally beat celeste" marked Elden Ring
 * completed. Before anything changes, each game an action targets must be
 * grounded: named in this message (by title, abbreviation, or a close typo),
 * or referred to ("it", "that one", "yes") when the conversation just
 * mentioned it. Ungrounded actions are dropped and the user is asked instead.
 */

export const READ_ONLY = new Set<string>([
  IntentType.LibraryQuestion,
  IntentType.AskQuestion,
  IntentType.Help,
  IntentType.RecommendGame,
  IntentType.SearchLibrary,
]);

const REFERENCE_WORDS =
  /\b(it|its|it's|that|this|them|they|those|these|there|here|same|again|yes|yeah|ya|yep|yup|sure|ok|okay|do it|do that|the game|last|latest|previous|both)\b/i;
/** "this game", "this one", "here" point at the page the user has open. */
const PAGE_WORDS = /\b(this game|this one|this|here)\b/i;

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };

const tokens = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (Object.prototype.hasOwnProperty.call(ROMAN, t) ? ROMAN[t] : t));

/** Sequel numbers in a title ("Hades II" -> ["2"]); years and "2077" don't count. */
const sequelNumbers = (title: string) => tokens(title).filter((t) => /^\d+$/.test(t) && Number(t) < 100);

/** Optimal string alignment distance: an adjacent swap counts as one edit ("sekrio" -> "sekiro"). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const GENERIC = new Set(["the", "of", "a", "an", "and", "game", "edition", "remastered", "definitive", "deluxe", "goty"]);

/** Words players use in commands and chat; a near-miss on one of these is the word itself, not a typo'd title. */
const EVERYDAY = new Set([
  "started", "starting", "start", "stared", "stars", "finished", "finally", "playing", "played", "player", "paused", "pause",
  "dropped", "completed", "complete", "removed", "remove", "rated", "rating", "review", "again", "anyway", "actually",
  "already", "night", "tonight", "today", "after", "before", "where", "there", "their", "these", "those", "think",
  "thing", "story", "games", "great", "still", "maybe", "about", "really", "trying", "going", "break", "collection",
]);

/** Does `text` name the game `title` (whole title, abbreviation, distinctive word, or a close typo of one)? */
export function mentions(text: string, title: string): boolean {
  const words = tokens(text);
  if (words.length === 0) return false;
  const titleWords = tokens(title).filter((t) => !GENERIC.has(t));
  // "hades" names Hades, not Hades II: a sequel's number has to be in the message too.
  const numbers = sequelNumbers(title);
  const hasNumbers = numbers.every((n) => words.includes(n));

  for (let size = 1; size <= Math.min(4, words.length); size++) {
    for (let i = 0; i + size <= words.length; i++) {
      // "out of the soulslike collection": "of the" alone doesn't name "Return of the Obra Dinn".
      if (words.slice(i, i + size).every((w) => GENERIC.has(w))) continue;
      const window = words.slice(i, i + size).join(" ");
      const expanded = expandAbbreviation(window);
      if (expanded && titleMatchScore(expanded, title) >= 90) return true;
      // Short common words ("top", "the") don't name a game unless they are its whole title.
      const score = titleMatchScore(window, title);
      if (hasNumbers && score >= 70 && (window.replace(/ /g, "").length >= 4 || score >= 95)) return true;
      // A franchise abbreviation ("cod" for Call of Duty: Modern Warfare II, or for Call of Duty:
      // Modern Warfare Remastered) names the game with or without a sequel number; plain words
      // ("hades") score lower and still need the number.
      if (score >= 90 && window.replace(/ /g, "").length >= 3) return true;
    }
  }
  if (!hasNumbers) return false;

  // A distinctive word of the title, typed exactly or with a small typo.
  return words.some((w) =>
    w.length >= 4 &&
    // Typos only count on longer words: "play" is one letter from "slay" (Slay the Spire).
    // Everyday words are never typos of a title: "started" is two letters from "stardew".
    titleWords.some((tw) => tw.length >= 4 && (w === tw || (w.length >= 5 && tw.length >= 5 && !EVERYDAY.has(w) && w[0] === tw[0] && editDistance(w, tw) <= (tw.length >= 7 ? 2 : 1)))),
  );
}

/**
 * Library titles a message names, best first. A title named with its exact words beats one
 * matched only through typo tolerance ("outer wilds" is Outer Wilds, not Breath of the Wild).
 */
export function namedTitles(text: string, owned: string[]): string[] {
  const named = owned.filter((t) => mentions(text, t));
  const said = new Set(tokens(text));
  const exact = named.filter((t) => {
    const distinctive = tokens(t).filter((w) => !GENERIC.has(w));
    return distinctive.length > 0 && distinctive.every((w) => said.has(w));
  });
  const pool = exact.length > 0 ? exact : named;
  if (pool.length > 0) return [...pool].sort((a, b) => b.length - a.length);

  // "the witcher" is The Witcher 3: Wild Hunt when that's the only Witcher owned. Only for
  // "Series N: Subtitle" titles -- a plain sequel ("Hades II") still needs its number.
  const bySeries = owned.filter((title) => {
    if (!/:/.test(title)) return false;
    const series = tokens(title.split(":")[0]).filter((w) => !GENERIC.has(w) && !/^\d+$/.test(w));
    return series.length > 0 && series.every((w) => said.has(w)) && series.some((w) => w.length >= 5);
  });
  return bySeries.length === 1 ? bySeries : [];
}

const FRANCHISE_FILLER =new Set(["the", "of", "a", "an", "and"]);

/** "gta" names Grand Theft Auto V when it's the only GTA in the library (initials, sequel numbers left out). */
export function franchiseMatch(text: string, owned: string[]): string | undefined {
  const asked = new Set(tokens(text).filter((w) => w.length >= 2 && !/^\d+$/.test(w)));
  const hits = owned.filter((title) => {
    const initials = tokens(title).filter((w) => !FRANCHISE_FILLER.has(w) && !/^\d+$/.test(w)).map((w) => w[0]).join("");
    return initials.length >= 2 && asked.has(initials);
  });
  return hits.length === 1 ? hits[0] : undefined;
}

export interface GroundingContext {
  message: string;
  /** The previous user message and assistant reply, for follow-ups. */
  recentText: string;
  /** What "it" currently points at, if anything. */
  currentGame?: string | null;
  /** The user's library titles, newest first. */
  owned?: string[];
  /** The game whose page the user has open. */
  pageGame?: string | null;
}

const LAST_ADDED = /\b(last|latest|newest|most recent(ly)?)\b[^.?!]*\badd(ed)?\b|\badded (last|most recently)\b/i;

/** Removes write intents aimed at games the user didn't name or refer to. Returns how many were dropped. */
export function dropUngroundedIntents(plan: IntentPlan, ctx: GroundingContext): number {
  const referential = REFERENCE_WORDS.test(ctx.message);
  const owned = ctx.owned ?? [];
  // Library games this message names ("yeet cod off my list" names Call of Duty).
  const byName = namedTitles(ctx.message, owned);
  const franchise = byName.length === 0 ? franchiseMatch(ctx.message, owned) : undefined;
  const named = franchise ? [franchise] : byName;
  let dropped = 0;

  plan.intents = plan.intents.filter((intent) => {
    if (READ_ONLY.has(intent.type)) return true;
    const games = (intent.targets ?? []).filter(
      (t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library,
    );
    const removing = intent.type === IntentType.RemoveGame;
    const ok = games.every((target) => {
      const name = target.name ?? "";
      if (!name.trim()) return true; // nothing to check; later stages ask for the game
      if (mentions(ctx.message, name)) return true;
      // "remove the last game I added": that's the newest game in the library.
      if (LAST_ADDED.test(ctx.message) && owned.length > 0 && games.length === 1) {
        target.name = owned[0];
        return true;
      }
      // "add this game to cozy nights" on Hollow Knight's page: this game is Hollow Knight.
      if (ctx.pageGame && PAGE_WORDS.test(ctx.message) && games.length === 1 && named.length === 0) {
        target.name = ctx.pageGame;
        return true;
      }
      // The message names exactly one library game but the model picked another: use the named one.
      if (named.length === 1 && games.length === 1 && target.type === IntentTargetType.Game) {
        target.name = named[0];
        return true;
      }
      if (!referential) return false;
      if (ctx.currentGame && (titleMatchScore(name, ctx.currentGame) >= 90 || mentions(name, ctx.currentGame))) return true;
      // Removals never rely on the previous reply happening to mention a game
      // (they fall through to "it" = the current game, and always ask first).
      if (!removing && mentions(ctx.recentText, name)) return true;
      // "add a note to it" right after rating Hollow Knight: the model guessed some other
      // game, but "it" is the game the conversation is on.
      if (ctx.currentGame && games.length === 1) {
        target.name = ctx.currentGame;
        return true;
      }
      return false;
    });
    if (!ok) dropped++;
    return ok;
  });

  return dropped;
}

/** Are these two names the same game? "Hades II" is not "Hades": sequel numbers have to agree. */
export function sameGame(a: string, b: string): boolean {
  // Numbers inside abbreviations count too ("cod mw2" is Modern Warfare 2); years don't.
  const numbersOf = (text: string) =>
    tokens(expandAbbreviation(text) ?? text)
      .flatMap((t) => t.match(/\d+/g) ?? [])
      .filter((n) => Number(n) < 100)
      .join(",");
  if (numbersOf(a) !== numbersOf(b)) return false;
  // `a` is what was asked for, `b` an owned title: every word asked for must be in the title
  // ("Hollow Knight: Silksong" is not "Hollow Knight"), allowing a typo only without extra words.
  const asked = tokens(expandAbbreviation(a) ?? a).filter((w) => !GENERIC.has(w));
  const title = new Set(tokens(b).filter((w) => !GENERIC.has(w)));
  if (asked.length > 0 && asked.every((w) => title.has(w))) return true;
  return asked.length <= title.size && (mentions(a, b) || titleMatchScore(a, b) >= 85);
}

/**
 * Of the library games a reply names, the one named last: after "I've added Sekiro, Elden Ring
 * and Dark Souls III to Soulslike", "remove that last game" / "it" is Dark Souls III.
 */
export function lastNamedTitle(text: string, owned: string[]): string | undefined {
  const named = namedTitles(text, owned);
  if (named.length <= 1) return named[0];
  const lower = text.toLowerCase();
  const position = (title: string) =>
    Math.max(-1, ...tokens(title).filter((w) => !GENERIC.has(w) && w.length >= 3).map((w) => lower.lastIndexOf(w)));
  return [...named].sort((a, b) => position(b) - position(a))[0];
}
