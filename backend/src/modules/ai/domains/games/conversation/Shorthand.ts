import { expandAbbreviation } from "../../../../rawg/gameAbbreviations";

/**
 * "is elden ring harder than ds3?" -> "... than ds3 (Dark Souls III)?": the answer model read
 * "ds3" as "Demon Slayer 3". Known game shorthand is spelled out before it sees the question.
 */
export function spellOutShorthand(question: string): string {
  // Words like "ds3", "botw", "rdr 2", "gta 5" -- letters with an optional (spaced) number.
  return question.replace(/\b[a-z]{2,6}(?:\s?\d{1,2})?\b/gi, (word) => {
    const full = expandAbbreviation(word);
    return full && full.toLowerCase() !== word.toLowerCase() ? `${word} (${full})` : word;
  });
}
