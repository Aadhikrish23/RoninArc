const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };
const FILLER = new Set(["the", "of", "a", "an", "and"]);

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (Object.prototype.hasOwnProperty.call(ROMAN, w) ? ROMAN[w] : w));

/**
 * Library search the way players type: "gta" and "gta 5" find Grand Theft Auto V,
 * "rdr2" finds Red Dead Redemption 2, "witcher" finds The Witcher 3: Wild Hunt.
 */
export function matchesTitle(title: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (title.toLowerCase().includes(q)) return true;

  const titleWords = words(title);
  const compactQuery = words(q).join("");
  if (!compactQuery) return true;
  if (titleWords.join("").includes(compactQuery)) return true;

  // Initials, numbers kept whole: "Grand Theft Auto V" -> "gta5", "Red Dead Redemption 2" -> "rdr2".
  const meaningful = titleWords.filter((w) => !FILLER.has(w));
  const initials = meaningful.map((w) => (/^\d+$/.test(w) ? w : w[0])).join("");
  return compactQuery.length >= 2 && initials.startsWith(compactQuery);
}
