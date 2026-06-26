export { normalizeTitle } from "./normalizeTitle";
export { scoreMatch } from "./scoreMatch";
export { validateMatch, MatchValidationResult } from "./validateMatch";
export { limitConcurrency } from "./concurrency";

const NON_GAME_REGEX = /\b(dlc|addon|add-on|expansion|season\s+pass|soundtrack|wallpaper|artbook|art\s+book|bonus|skin|outfit|pack|editor|dedicated\s+server|sdk|mod\s+kit|modkit|resource\s+archiver|benchmark|demo|test\s+server)\b/i;

/**
 * Checks if a game title corresponds to non-game items (DLC, Addon, Soundtrack, etc.).
 */
export function isNonGame(title: string): boolean {
  if (!title) return true;
  return NON_GAME_REGEX.test(title);
}
