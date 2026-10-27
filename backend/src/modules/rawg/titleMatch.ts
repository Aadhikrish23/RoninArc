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
    // "Ragnarök", "Pokémon": accents fold to the plain letter people type, instead of splitting the word.
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // "Baldur's Gate III" is "baldurs gate 3" (so "bg3" is its initials), not "baldur s gate 3".
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => (Object.prototype.hasOwnProperty.call(ROMAN, t) ? ROMAN[t] : t));

/** "Red Dead Redemption 2" -> "rdr2", "The Legend of Zelda" -> "lz" (and "tloz"). Numbers stay whole. */
const acronyms = (tokens: string[]): string[] => {
  const initials = (ts: string[]) => ts.map((t) => (/^\d+$/.test(t) ? t : t[0])).join("");
  const meaningful = tokens.filter((t) => !FILLER.has(t));
  return [...new Set([initials(tokens), initials(meaningful)])].filter((a) => a.length >= 2);
};

/** Edit distance where swapping two neighbouring letters counts as one edit. */
function typoDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * "dark souls 1" / "dark souls i": the first game of a series usually has no number in its title
 * ("Dark Souls: Remastered"), so a trailing 1 counts as optional when the title has no number.
 */
export function titleMatchScore(query: string, title: string): number {
  const score = scoreTitle(query, title);
  const q = tokenize(query);
  const firstOfSeries = q.length > 1 && (q[q.length - 1] === "1" || q[q.length - 1] === "i");
  if (!firstOfSeries || tokenize(title).some((t) => /^\d+$/.test(t))) return score;
  return Math.max(score, scoreTitle(q.slice(0, -1).join(" "), title));
}

function scoreTitle(query: string, title: string): number {
  const q = tokenize(query);
  const t = tokenize(title);
  if (q.length === 0 || t.length === 0) return 0;
  if (q.join(" ") === t.join(" ")) return 100;

  // Abbreviations, against the whole title and each "Main: Subtitle" part.
  const compactQuery = q.join("");
  const pieces = title.split(/[:\-–—]/).map(tokenize).filter((p) => p.length > 0);
  const parts = [t, ...pieces];
  // Only a real "Main: Subtitle" split has subtitles; "Skyrim Stuff" is just a title.
  const subtitles = pieces.length > 1 ? pieces.slice(1) : [];
  // "skyrim" is the subtitle of "The Elder Scrolls V: Skyrim".
  if (subtitles.some((p) => p.join(" ") === q.join(" "))) return 95;
  // "hifi rush" is "Hi-Fi Rush".
  if (compactQuery === t.join("")) return 98;
  // "skyrim" also names "The Elder Scrolls V: Skyrim Special Edition", ahead of "Skyrim Stuff".
  const subtitleStart = subtitles.find((p) => p.length > q.length && p.slice(0, q.length).join(" ") === q.join(" "));
  if (subtitleStart) return Math.max(85, 92 - (subtitleStart.length - q.length) * 2);
  if (parts.some((p) => acronyms(p).includes(compactQuery))) return 90;

  // Every query word appears in the title (exact word, or a prefix of 3+ letters).
  const hit = (qt: string) => t.some((tt) => tt === qt || (qt.length >= 3 && tt.startsWith(qt)));
  const matched = q.filter(hit).length;
  if (matched === q.length) {
    // Prefer the tightest title: "Hollow Knight" over "Hollow Knight: Silksong".
    return Math.max(60, 80 - (t.length - q.length) * 2);
  }
  // With typos, the closest part counts ("skyrimm" is the "Skyrim" in "The Elder Scrolls V: Skyrim").
  const typoScores = parts
    .filter((p) => q.every((qt) => p.some((pt) => pt === qt || (qt.length >= 3 && pt.startsWith(qt)) || (qt.length >= 5 && pt.length >= 5 && qt[0] === pt[0] && typoDistance(qt, pt) <= (pt.length >= 8 ? 2 : 1)))))
    .map((p) => Math.max(55, 72 - (p.length - q.length) * 2));
  if (typoScores.length > 0) return Math.max(...typoScores);
  return Math.round((matched / q.length) * 50);
}

/** Results sorted by match quality; ties keep RAWG's own (relevance) order. */
export function rankByTitle<T extends { name?: string; added?: number }>(query: string, results: T[]): { item: T; score: number; rank: number }[] {
  // Among good matches, the game people actually own beats a tool or fan upload with a tighter
  // title: "the witcher 3" is The Witcher 3: Wild Hunt, not "The Witcher 3 REDkit". Only the order
  // changes; the score reported (and checked against thresholds) is the title match alone.
  const popularity = (item: T, score: number) => (score >= 60 ? Math.min(8, Math.log10((item.added ?? 0) + 1) * 2) : 0);
  return results
    .map((item, index) => {
      const score = titleMatchScore(query, item.name || "");
      return { item, index, score, rank: score + popularity(item, score) };
    })
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map(({ item, score, rank }) => ({ item, score, rank }));
}

/** Below this, nothing in the results is really what was asked for. */
export const MIN_CONFIDENT_MATCH = 40;
