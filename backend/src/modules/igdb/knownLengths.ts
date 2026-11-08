/**
 * Reported lengths can be well off for some popular games, and comparisons like "something like
 * Celeste but shorter" depend on them. For well-known games, use the typical main-story length
 * instead (rounded, HowLongToBeat-style figures).
 */
const MAIN_STORY_HOURS: Record<string, number> = {
  "hollow knight": 27,
  "red dead redemption 2": 50,
  "the witcher 3 wild hunt": 52,
  hades: 22,
  "outer wilds": 17,
  cuphead: 11,
  celeste: 8,
};

const key = (name: string) =>
  name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The length to use for a game: the known main-story length if there is one, else the reported one. */
export function playtimeFor(name: string | undefined, reported: number | undefined): number | undefined {
  const known = name ? MAIN_STORY_HOURS[key(name)] : undefined;
  return known ?? reported;
}
