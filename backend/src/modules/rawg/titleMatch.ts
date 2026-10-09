/**
 * How well a game title matches what someone typed, 0-100.
 *
 * RAWG's search is fuzzy and people type the way they talk ("rdr 2",
 * "gta 5", "witcher 3"), so picking "the first result" adds the wrong game.
 * This scores a title against the query so callers can pick the real match,
 * or admit there isn't one.
 */

const ROMAN: Record<string, string> = {
  ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12",
};
const FILLER = new Set(["the", "of", "a", "an", "and"]);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ROMAN[t] ?? t);

/** "Red Dead Redemption 2" -> "rdr2", "The Legend of Zelda" -> "lz" (and "tloz"). Numbers stay whole. */
const acronyms = (tokens: string[]): string[] => {
  const initials = (ts: string[]) => ts.map((t) => (/^\d+$/.test(t) ? t : t[0])).join("");
  const meaningful = tokens.filter((t) => !FILLER.has(t));
  return [...new Set([initials(tokens), initials(meaningful)])].filter((a) => a.length >= 2);
};

export function titleMatchScore(query: string, title: string): number {
  const q = tokenize(query);
  const t = tokenize(title);
  if (q.length === 0 || t.length === 0) return 0;
  if (q.join(" ") === t.join(" ")) return 100;

  // Abbreviations, against the whole title and each "Main: Subtitle" part.
  const compactQuery = q.join("");
  const parts = [t, ...title.split(/[:\-–—]/).map(tokenize).filter((p) => p.length > 0)];
  // "skyrim" is the subtitle of "The Elder Scrolls V: Skyrim".
  if (parts.slice(1).some((p) => p.join(" ") === q.join(" "))) return 95;
  if (parts.some((p) => acronyms(p).includes(compactQuery))) return 90;

  // Every query word appears in the title (exact word, or a prefix of 3+ letters).
  const hit = (qt: string) => t.some((tt) => tt === qt || (qt.length >= 3 && tt.startsWith(qt)));
  const matched = q.filter(hit).length;
  if (matched === q.length) {
    // Prefer the tightest title: "Hollow Knight" over "Hollow Knight: Silksong".
    return Math.max(60, 80 - (t.length - q.length) * 2);
  }
  return Math.round((matched / q.length) * 50);
}

/** Results sorted by match quality; ties keep RAWG's own (relevance) order. */
export function rankByTitle<T extends { name?: string }>(query: string, results: T[]): { item: T; score: number }[] {
  return results
    .map((item, index) => ({ item, index, score: titleMatchScore(query, item.name || "") }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item, score }) => ({ item, score }));
}

/** Below this, nothing in the results is really what was asked for. */
export const MIN_CONFIDENT_MATCH = 40;
