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
  // words() leaves only letters, digits and spaces, so the series is safe inside a pattern.
  const pattern = new RegExp(`(^| )${series}( |$)`);
  return owned.filter((title) => pattern.test(words(title)));
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

/** Adds one collection step per owned game in the series the message asked for. */
export function fillSeriesCollection(plan: IntentPlan, message: string, owned: string[]) {
  const series = seriesAsked(message);
  if (!series) return;
  const collection = plan.intents
    .filter((i) => i.type === IntentType.CreateCollection || i.type === IntentType.OrganizeCollection)
    .flatMap((i) => i.targets ?? [])
    .find((t) => t.type === IntentTargetType.Collection)?.name;
  if (!collection) return;
  for (const title of seriesTitles(series, owned)) {
    const already = plan.intents.some(
      (i) =>
        i.type === IntentType.OrganizeCollection &&
        (i.targets ?? []).some((t) => t.type === IntentTargetType.Game && words(t.name ?? "") === words(title)),
    );
    if (already) continue;
    plan.intents.push({
      type: IntentType.OrganizeCollection,
      targets: [
        { type: IntentTargetType.Collection, name: collection },
        { type: IntentTargetType.Game, name: title },
      ],
      parameters: [{ type: IntentParameterType.Boolean, value: true }],
    } as any);
  }
}
