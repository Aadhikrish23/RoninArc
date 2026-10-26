/**
 * RAWG's "playtime" is the average its users logged, not how long a game takes to beat, and for
 * some popular games it's far too low: Hollow Knight comes back as 7h, Hades as 10h. That made
 * "something like Celeste but shorter" suggest Hollow Knight. For the well-known games where it's
 * badly off, use the typical main-story length instead (rounded, HowLongToBeat-style figures).
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

/** The playtime to use for a game: the known main-story length when RAWG's figure is off, else RAWG's. */
export function playtimeFor(name: string | undefined, rawgPlaytime: number | undefined): number | undefined {
  const known = name ? MAIN_STORY_HOURS[key(name)] : undefined;
  return known ?? rawgPlaytime;
}
