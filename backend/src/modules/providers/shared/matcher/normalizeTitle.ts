/**
 * Normalizes title string to facilitate comparison.
 * - lowercases
 * - removes punctuation
 * - removes trademark symbols
 * - removes edition suffixes
 * - normalizes roman numerals to arabic
 * - removes duplicate spaces
 */
export function normalizeTitle(title: string): string {
  if (!title) return "";

  // 1. Lowercase
  let normalized = title.toLowerCase();

  // 2. Remove trademark/copyright/registration symbols
  normalized = normalized.replace(/[™®©]/g, "");

  // 3. Remove edition/version suffixes
  const editionRegex = /\b(goty edition|goty|game of the year edition|game of the year|definitive edition|deluxe edition|standard edition|collector'?s edition|gold edition|complete edition|anniversary edition|legendary edition|director'?s cut|enhanced edition|remastered|ultimate edition|special edition|remake)\b/g;
  normalized = normalized.replace(editionRegex, "");

  // 4. Normalize Roman numerals
  // Replace Roman numeral strings at word boundaries with Arabic numbers.
  // We match longer ones first to avoid matching parts (e.g., viii before vii before v).
  const romanMap: { [key: string]: string } = {
    viii: "8",
    vii: "7",
    iii: "3",
    ii: "2",
    iv: "4",
    vi: "6",
    ix: "9",
    v: "5",
    x: "10"
  };

  for (const roman of Object.keys(romanMap)) {
    const val = romanMap[roman];
    const regex = new RegExp(`\\b${roman}\\b`, "g");
    normalized = normalized.replace(regex, val);
  }

  // 5. Replace punctuation with space
  normalized = normalized.replace(/[/\-_\\:!?,.()&[\]+*|]/g, " ");

  // Remove apostrophes completely so "death's" -> "deaths"
  normalized = normalized.replace(/['’]/g, "");

  // 6. Remove duplicate spaces and trim
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}
