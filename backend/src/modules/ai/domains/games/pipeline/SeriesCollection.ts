import { IntentPlan } from "../../../intent/IntentPlan";
import { IntentType } from "../intent/IntentType";
import { IntentParameterType } from "../../../intent/IntentParameterType";
import { IntentTargetType } from "../../../intent/IntentTargetType";

/**
 * "create a collection called god of war and add all the god of war games i have to it": the model
 * planned the new collection and dropped the second half. The owned games in that series go in it.
 */

// "all the god of war games", "every batman game", "all of my souls games".
const ALL_OF = /\b(?:all|every)\s+(?:of\s+)?(?:the\s+|my\s+)?([a-z0-9][a-z0-9:'’&. -]*?)\s+games?\b/i;
// "my god of war games" (no "all") still means each of them.
const MY_SERIES = /\bmy\s+([a-z0-9][a-z0-9:'’&. -]*?)\s+games\b/i;
// "...and all the god of war games i have in my library to that collection" has no verb at all.
const ADDS = /\b(add|put|throw|chuck|toss|stick|move|include|fill|to|in|into|with)\b/i;
// "all my steam games", "all the games i own": a store or the whole library, not a series.
const NOT_A_SERIES = /^(the|my|these|those|them|other|owned|installed|new|old|steam|epic|pc|video|\d+)$/i;

const words = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The series the message wants in a collection ("god of war"), if it asks for every game in one. */
export function seriesAsked(message: string): string | undefined {
  if (!ADDS.test(message)) return undefined;
  const match = message.match(ALL_OF) ?? message.match(MY_SERIES);
  const series = match ? words(match[1]).replace(/^(?:the|my)\s+/, "") : "";
  if (!series || NOT_A_SERIES.test(series) || series.split(" ").length > 5) return undefined;
  return series;
}

/** Owned titles in a series: "god of war" is God of War, God of War II and God of War Ragnarök. */
export function seriesTitles(series: string, owned: string[]): string[] {
  return seriesGames(series, owned.map((title) => ({ title }))).map((g) => g.title);
}

/** The owned games in a series, each one, even when two share a title. */
export function seriesGames<G extends { title: string }>(series: string, owned: G[]): G[] {
  // words() leaves only letters, digits and spaces, so the series is safe inside a pattern.
  const pattern = new RegExp(`(^| )${series}( |$)`);
  return owned.filter((game) => pattern.test(words(game.title)));
}

const isBulkName = (name = "") => /^(all|every)\s|\sgames?$/i.test(name.trim());

/** Takes out the model's own "all X games" steps; the owned games are added by name instead. */
export function dropBulkCollectionSteps(plan: IntentPlan, message: string) {
  if (!seriesAsked(message)) return;
  plan.intents = plan.intents.filter(
    (i) =>
      i.type !== IntentType.OrganizeCollection ||
      !(i.targets ?? []).some((t) => t.type === IntentTargetType.Game && isBulkName(t.name)),
  );
}

const removes = (intent: any) =>
  (intent.parameters ?? []).some((p: any) => String(p.type).toLowerCase() === "boolean" && (p.value === false || p.value === "false"));

/**
 * Adds one collection step per owned game in the series the message asked for. Each step carries
 * the game's id: the user can own two games with one title (God of War, 2005 and 2018), and a
 * step that only names "God of War" reaches just one of them.
 */
export function fillSeriesCollection(plan: IntentPlan, message: string, owned: { title: string; id?: string }[]) {
  const series = seriesAsked(message);
  if (!series) return;
  const collection = plan.intents
    .filter((i) => i.type === IntentType.CreateCollection || i.type === IntentType.OrganizeCollection)
    .flatMap((i) => i.targets ?? [])
    .find((t) => t.type === IntentTargetType.Collection)?.name;
  if (!collection) return;

  const games = seriesGames(series, owned);
  const count = new Map<string, number>();
  for (const g of games) count.set(words(g.title), (count.get(words(g.title)) ?? 0) + 1);
  const shared = (name: string) => (count.get(words(name)) ?? 0) > 1;

  // "God of War" by name alone would add one of the two; they go in by id below instead.
  plan.intents = plan.intents.filter(
    (i) =>
      i.type !== IntentType.OrganizeCollection ||
      removes(i) ||
      !(i.targets ?? []).some((t) => t.type === IntentTargetType.Game && !t.id && shared(t.name ?? "")),
  );

  for (const game of games) {
    const already = plan.intents.some(
      (i) =>
        i.type === IntentType.OrganizeCollection &&
        !removes(i) &&
        (i.targets ?? []).some(
          (t) => t.type === IntentTargetType.Game && (game.id && t.id ? t.id === game.id : words(t.name ?? "") === words(game.title)),
        ),
    );
    if (already) continue;
    plan.intents.push({
      type: IntentType.OrganizeCollection,
      targets: [
        { type: IntentTargetType.Collection, name: collection },
        { type: IntentTargetType.Game, name: game.title, ...(game.id ? { id: game.id } : {}) },
      ],
      parameters: [{ type: IntentParameterType.Boolean, value: true }],
    } as any);
  }
}

/**
 * Collection steps that grounding dropped ("God of War II" when the message only says "god of
 * war") and the series fill put back: they weren't left undone, so they don't earn the "I wasn't
 * sure which game you meant" note.
 */
export function restoredBySeries(dropped: IntentPlan["intents"], plan: IntentPlan): number {
  const inPlan = new Set(
    plan.intents
      .filter((i) => i.type === IntentType.OrganizeCollection)
      .flatMap((i) => (i.targets ?? []).filter((t) => t.type === IntentTargetType.Game).map((t) => words(t.name ?? ""))),
  );
  return dropped.filter(
    (i) =>
      i.type === IntentType.OrganizeCollection &&
      (i.targets ?? []).some((t) => t.type === IntentTargetType.Game) &&
      (i.targets ?? []).filter((t) => t.type === IntentTargetType.Game).every((t) => inPlan.has(words(t.name ?? ""))),
  ).length;
}
