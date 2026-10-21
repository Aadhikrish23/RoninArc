import rawgService, { type GameFacts } from "../../rawg/rawgService";
import { rankByTitle } from "../../rawg/titleMatch";
import { expandAbbreviation } from "../../rawg/gameAbbreviations";
import { namedTitles } from "./TargetGrounding";

/**
 * Facts from the game database for the games a question is about, so the answer model doesn't
 * guess them: it said Silksong "hasn't come out yet", put Outer Wilds at 4 hours, and called
 * Genichiro an Elden Ring boss. Release dates, developers and genres come from RAWG; anything
 * RAWG doesn't know is left out rather than filled in.
 */

/** Games named in a question that may not be in the library: "is pentiment worth it", "how long is outer wilds". */
const ABOUT_GAME = [
  /\b(?:play|start|try|get|do)\s+(.+?)\s+(?:or|vs\.?|versus)\s+(.+?)(?:\s+first|\s+next)?[?.!]*$/i,
  /\bis\s+(.+?)\s+(?:harder|easier|longer|shorter|better|scarier|bigger)\s+than\s+(.+?)(?:[?.!,]|$)/i,
  /\bhow long (?:is|does|to beat|would)\s+(.+?)\s*(?:take|to beat|to finish|last|\?|$)/i,
  /\bis\s+(.+?)\s+(?:worth|good|hard|harder|easier|scary|long|short|fun|any good|co-?op|multiplayer)\b/i,
  /\b(?:tips|advice|help|build|guide)\s+(?:for|on|in|with)\s+(.+?)(?:[?.!,]|$)/i,
  /\b(?:should i (?:play|start|try|get))\s+(.+?)(?:\s+(?:or|first|next|before|after)\b|[?.!,]|$)/i,
  /\b(.+?)\s+(?:vs\.?|versus|or)\s+(.+?)(?:\s+first)?[?.!]*$/i,
];

/** Words those patterns catch that aren't games ("what should i play tonight"). */
const NOT_A_GAME = /^(it|this|that|this one|that one|this game|that game|tonight|today|now|next|something|anything|games?|more|again|them|these|those|one)$/i;

const cache = new Map<string, Promise<GameFacts | undefined>>();

async function lookUp(title: string): Promise<GameFacts | undefined> {
  const key = title.toLowerCase();
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const term = expandAbbreviation(title) ?? title;
        const results = await rawgService.searchBestMatch(term, 5).catch(() => []);
        const best = rankByTitle(term, results as any[])[0];
        if (!best || best.score < 70) return undefined;
        const facts = await rawgService.getGameFacts((best.item as any).id);
        return facts.name ? facts : undefined;
      })(),
    );
  }
  return cache.get(key)!;
}

function describe(f: GameFacts): string {
  const parts: string[] = [];
  if (f.released) {
    const date = new Date(f.released);
    const when = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    parts.push(date.getTime() <= Date.now() ? `released ${when}` : `not out yet, set for ${when}`);
  } else {
    parts.push("no release date listed");
  }
  if (f.developers?.length) parts.push(`developer ${f.developers.slice(0, 2).join(", ")}`);
  if (f.genres?.length) parts.push(`genres ${f.genres.slice(0, 4).join(", ")}`);
  // RAWG's average is hours logged, not time to beat (Hollow Knight: 7); only long ones are worth passing on.
  if (f.playtime >= 15) parts.push(`players log at least ${f.playtime} hours on average`);
  return `${f.name}: ${parts.join("; ")}.`;
}

/** Up to two games the question is about: library titles it names, else titles it mentions. */
export function gamesInQuestion(question: string, owned: string[]): string[] {
  const named = namedTitles(question, owned).slice(0, 2);
  if (named.length > 0) return named;
  for (const re of ABOUT_GAME) {
    const m = question.match(re);
    if (!m) continue;
    const titles = m
      .slice(1)
      .filter(Boolean)
      .map((t) => t.replace(/^(?:the game|a game|playing|getting|starting)\s+/i, "").replace(/\s+(?:yet|actually|really|even|first|next)$/i, "").trim())
      .filter((t) => t.length >= 2 && t.split(/\s+/).length <= 6 && !NOT_A_GAME.test(t));
    if (titles.length > 0) return titles.slice(0, 2);
  }
  return [];
}

/** One line per game, or undefined when nothing could be looked up (never slower than ~4s). */
export async function factsForQuestion(question: string, owned: string[]): Promise<string | undefined> {
  const titles = gamesInQuestion(question, owned);
  if (titles.length === 0) return undefined;
  const lookups = Promise.all(titles.map((t) => lookUp(t).catch(() => undefined)));
  const facts = await Promise.race([lookups, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 4000))]);
  const lines = (facts ?? []).filter((f): f is GameFacts => !!f).map(describe);
  return lines.length > 0 ? lines.join("\n") : undefined;
}

/** "how long is outer wilds" for a game that isn't in the library: RAWG's average, when it's reliable. */
export async function playtimeFor(title: string): Promise<{ name: string; hours: number } | undefined> {
  const f = await lookUp(title).catch(() => undefined);
  return f?.name && f.playtime >= 15 ? { name: f.name, hours: f.playtime } : undefined;
}
