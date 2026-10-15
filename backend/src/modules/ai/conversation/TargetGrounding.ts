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
      const window = words.slice(i, i + size).join(" ");
      const expanded = expandAbbreviation(window);
      if (expanded && titleMatchScore(expanded, title) >= 90) return true;
      // Short common words ("top", "the") don't name a game unless they are its whole title.
      const score = titleMatchScore(window, title);
      if (hasNumbers && score >= 70 && (window.replace(/ /g, "").length >= 4 || score >= 95)) return true;
      // A franchise abbreviation ("cod" for Call of Duty: Modern Warfare II) names the game
      // even without the sequel number; plain words ("hades") still need it.
      if (!hasNumbers && score >= 90 && window.replace(/ /g, "").length >= 3) return true;
    }
  }
  if (!hasNumbers) return false;

  // A distinctive word of the title, typed exactly or with a small typo.
  return words.some((w) =>
    w.length >= 4 &&
    titleWords.some((tw) => tw.length >= 4 && (w === tw || editDistance(w, tw) <= (tw.length >= 7 ? 2 : 1))),
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
  return [...pool].sort((a, b) => b.length - a.length);
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
