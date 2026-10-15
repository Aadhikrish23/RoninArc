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
