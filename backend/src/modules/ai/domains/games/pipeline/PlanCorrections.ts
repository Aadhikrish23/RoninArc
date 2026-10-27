import { IntentPlan } from "../../../intent/IntentPlan";
import { IntentType } from "../intent/IntentType";
import { IntentParameterType } from "../../../intent/IntentParameterType";
import { IntentTargetType } from "../../../intent/IntentTargetType";
import { READ_ONLY } from "../conversation/TargetGrounding";
import { titleMatchScore } from "../../../../rawg/titleMatch";
import { asksToReadNotes, collectionDirection, collectionDirectionFor, isQuestionOnly, meansDroppedStatus, statedScore, wasAskedFor } from "../conversation/FollowUps";

/**
 * The plan, corrected by what the user actually said: the model's reading of a message
 * is checked against the message's own words. Returns how many planned changes were
 * dropped because nothing in the message asked for them.
 */
export function correctPlan(plan: IntentPlan, message: string, lastReply = ""): { unrequested: number } {
  // "remove that last game" right after "I've added Dark Souls III to your collection "Soulslike"":
  // the conversation is about the collection, so it comes out of the collection, not the library.
  const collectionJustUsed = lastReply.match(/to your collection "([^"]+)"/)?.[1];
  // "remove that last game, i refunded it": a game you no longer own leaves the library.
  if (collectionJustUsed && !/\b(library|entirely|completely|for good|altogether|uninstall\w*|refund\w*|sold|don'?t own|dont own|no longer own|got rid)\b/i.test(message)) {
    // "that last game" after 'I've added Dark Souls III and Hollow Knight to your collection' is
    // Hollow Knight, the one named last (the model picked Dark Souls III).
    // Within one sentence only: across sentences the capture once became "Dark Souls III to your
    // library as Plan to Play. I've added Dark Souls III".
    const lastAdded = [...lastReply.matchAll(/added ([^.!?"]+?) to your collection "/g)].pop()?.[1].split(/,\s*|\s+and\s+/).pop()?.trim();
    const meansLast = /\b(that|the) last (game|one)\b|\blast one\b/i.test(message);
    for (const intent of plan.intents) {
      if (intent.type !== IntentType.RemoveGame || !/\b(that|it|last|this)\b/i.test(message)) continue;
      intent.type = IntentType.OrganizeCollection;
      const games = (intent.targets ?? []).map((t) => ({ ...t, type: IntentTargetType.Game }));
      intent.targets = [
        ...(meansLast && lastAdded && games.length === 1 ? [{ ...games[0], name: lastAdded }] : games),
        { type: IntentTargetType.Collection, name: collectionJustUsed },
      ];
      intent.parameters = [{ type: IntentParameterType.Boolean, value: false } as any];
    }
  }

  // A question never changes anything ("should i play elden ring or sekiro first?").
  if (isQuestionOnly(message)) {
    const reads = plan.intents.filter((intent) => READ_ONLY.has(intent.type));
    plan.intents = reads.length > 0 ? reads : [{ type: IntentType.AskQuestion, targets: [], parameters: [] } as any];
  }

  // "just beat witcher 3, 10/10 masterpiece": the score is a rating too, even if the model only
  // planned the status change.
  const score = statedScore(message);
  const ratesAlready = plan.intents.some((i) => i.type === IntentType.RateGame || i.type === IntentType.ReviewGame);
  if (score !== undefined && !ratesAlready) {
    const games = plan.intents
      .flatMap((i) => i.targets ?? [])
      .filter((t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library);
    // "add portal 2 and doom, mark portal 2 completed with a 10, start doom": the score goes with
    // the game named last before it, not just the first game in the plan.
    const lower = message.toLowerCase();
    const scoreAt = lower.search(/\d{1,2}(?:\.5)?\s*(?:\/|out of)\s*10\b|\b(?:with|rated?|give it|gave it|its|it'?s)\s+(?:an?\s+)?\d/);
    const before = (name: string) => {
      const words = name.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").trim();
      return scoreAt < 0 ? -1 : lower.replace(/[^a-z0-9 ]+/g, " ").slice(0, scoreAt).lastIndexOf(words);
    };
    const target = games.reduce<(typeof games)[number] | undefined>(
      (best, t) => (t.name && before(t.name) > (best?.name ? before(best.name) : -1) ? t : best),
      undefined,
    ) ?? games[0];
    if (target?.name) {
      plan.intents.push({
        type: IntentType.RateGame,
        targets: [{ type: IntentTargetType.Game, name: target.name }],
        parameters: [{ type: IntentParameterType.Rating, value: score }],
      } as any);
    }
  }

  // "drop gta 5 its mid" is the Dropped status, never a removal from the library.
  if (meansDroppedStatus(message)) {
    for (const intent of plan.intents) {
      if (intent.type !== IntentType.RemoveGame) continue;
      intent.type = IntentType.SetStatus;
      intent.targets = (intent.targets ?? []).map((t) => ({ ...t, type: IntentTargetType.Game }));
      intent.parameters = [{ type: IntentParameterType.Status, value: "dropped" } as any];
    }
  }

  // "put ds3 in there" adds; "take it out of soulslikes" removes -- whatever the model flagged.
  for (const intent of plan.intents) {
    if (intent.type !== IntentType.OrganizeCollection) continue;
    const game = intent.targets?.find((t) => t.type === IntentTargetType.Game)?.name;
    // The game's own clause decides first ("silksong goes in X, not stardew. take stardew out").
    const direction = (game && collectionDirectionFor(message, game)) || collectionDirection(message);
    if (direction) {
      const others = (intent.parameters ?? []).filter((p: any) => String(p.type).toLowerCase() !== "boolean");
      intent.parameters = [...others, { type: IntentParameterType.Boolean, value: direction === "add" } as any];
    }
  }

  // Changes the message never asked for: "add a note on that one" planned a status change too,
  // "remind me saturday to try outer wilds" planned a new collection.
  const before = plan.intents.length;
  plan.intents = plan.intents.filter((intent) => wasAskedFor(intent.type, message));
  const unrequested = before - plan.intents.length;

  // "make a soulslike collection" is a collection called "Soulslike", not "Soulslike Collection"
  // (unless the name was given outright: 'called "Retro Collection"').
  if (!/\b(called|named)\b|["“]/i.test(message)) {
    const renamed = new Map<string, string>();
    for (const intent of plan.intents) {
      if (intent.type !== IntentType.CreateCollection) continue;
      for (const target of intent.targets ?? []) {
        if (target.type === IntentTargetType.Collection && / collection$/i.test(target.name ?? "") && target.name.length > 11) {
          const short = target.name.replace(/ collection$/i, "");
          renamed.set(target.name.toLowerCase(), short);
          target.name = short;
        }
      }
    }
    // The same plan's "add it to Soulslike Collection" must use the new name too, or the add
    // step creates a second collection.
    for (const intent of plan.intents) {
      for (const target of intent.targets ?? []) {
        const short = target.type === IntentTargetType.Collection ? renamed.get((target.name ?? "").toLowerCase()) : undefined;
        if (short) target.name = short;
      }
    }
  }

  // "read me my notes" is never a note to save.
  if (asksToReadNotes(message)) {
    plan.intents = plan.intents.map((intent) =>
      intent.type === IntentType.AddNote
        ? { ...intent, type: IntentType.LibraryQuestion, parameters: [{ type: IntentParameterType.Text, value: message }] as any }
        : intent,
    );
  }

  recoverFinishedGames(plan, message);
  answerTheQuestionToo(plan, message);

  return { unrequested };
}

const FINISHED = /\b(?:i\s+(?:even\s+|just\s+|already\s+|finally\s+)?)?(?:beat|finished|completed|cleared|platinum(?:ed)?)\s+(.+)$/i;
const COMMENT = /^(its|it's|it was|it is|was|is|so|but|both|really|honestly|which|that was|loved|amazing|great|awesome|fun|mid|meh)\b|\d+\s*(\/|out of)\s*10/i;
const NOT_A_GAME =/^(it|them|that|this|those|these|the game|the games|all|everything|both|one|ones|game|games)$/i;

/** "i even beat elden ring and dark souls 1": the games named after "beat"/"finished" in a statement. */
export function finishedGamesIn(message: string): string[] {
  const names: string[] = [];
  for (const sentence of message.split(/(?:\.\.\.|[.?!;\n])+/)) {
    const match = sentence.match(FINISHED);
    if (!match) continue;
    // "have i beaten X?", "the ones i completed", "what did i finish": not news about a game.
    const before = sentence.slice(0, match.index ?? 0);
    if (/\b(the ones|the games|what|which|have|did|if|should|could|would|will|when|once|after)\s*$/i.test(before) || /\b(have|did)\s+i\b/i.test(sentence)) continue;
    for (const part of match[1].split(/\s*(?:,|&|\band\b|\balso\b)\s*/i)) {
      // "beat hades, its a 10/10 honestly": what comes after the games is commentary, not more games.
      if (COMMENT.test(part)) break;
      const name = part.replace(/\b(too|as well|already|last (?:week|night|month|year)|yesterday|today|recently)\b/gi, "").replace(/[^\w\s:'&-]+$/g, "").trim();
      if (name.length >= 2 && !NOT_A_GAME.test(name)) names.push(name);
    }
  }
  return names;
}

/**
 * "I like souls games, i even beat elden ring and dark souls 1... should I play ds2 and ds3? make a
 * collection and put the ones i completed": the model planned the new games and the collection but
 * dropped the two the user finished. Plan them as Completed (an unowned game is added first), and
 * when the message asks for "the ones I completed" in a collection, put them in it.
 */
function recoverFinishedGames(plan: IntentPlan, message: string) {
  const finished = finishedGamesIn(message);
  if (finished.length === 0) return;
  const completes = (name: string) =>
    plan.intents.some(
      (i) =>
        (i.type === IntentType.CompleteGame || (i.type === IntentType.SetStatus && i.parameters?.some((p) => p.value === "completed"))) &&
        (i.targets ?? []).some((t) => sameName(t.name, name)),
    );
  // Use the model's own spelling of a game it already plans ("Dark Souls I"), so the add-then-mark
  // step sees one game, not two.
  const planned = plan.intents.flatMap((i) => i.targets ?? []).filter((t) => t.type !== IntentTargetType.Collection);
  const spelled = (name: string) => planned.find((t) => sameName(t.name, name))?.name ?? name;
  for (const name of finished) {
    if (completes(name)) continue;
    plan.intents.push({
      type: IntentType.SetStatus,
      targets: [{ type: IntentTargetType.Game, name: spelled(name) }],
      parameters: [{ type: IntentParameterType.Status, value: "completed" }],
    } as any);
  }
  if (!/\b(the ones|the games|ones|games)\s+(?:i(?:'ve| have)?\s+)?(completed|finished|beat|beaten|cleared)\b/i.test(message)) return;
  const collection = plan.intents
    .filter((i) => i.type === IntentType.CreateCollection || i.type === IntentType.OrganizeCollection)
    .flatMap((i) => i.targets ?? [])
    .find((t) => t.type === IntentTargetType.Collection)?.name;
  if (!collection) return;
  // "put the ones I completed" in it: the model also put in DS2 and DS3, which the user only asked
  // about. Unless the message asks for suggestions in there too, only finished games go in.
  if (!/\b(ones?|games?)\s+(you|u)\s+(suggest|recommend)/i.test(message)) {
    plan.intents = plan.intents.filter(
      (i) =>
        i.type !== IntentType.OrganizeCollection ||
        !(i.targets ?? []).some((t) => t.type === IntentTargetType.Collection && t.name === collection) ||
        (i.targets ?? []).filter((t) => t.type !== IntentTargetType.Collection).every((t) => finished.some((f) => sameName(t.name, f))),
    );
  }
  for (const name of finished) {
    const already = plan.intents.some(
      (i) => i.type === IntentType.OrganizeCollection && (i.targets ?? []).some((t) => t.type !== IntentTargetType.Collection && sameName(t.name, name)),
    );
    if (already) continue;
    plan.intents.push({
      type: IntentType.OrganizeCollection,
      targets: [
        { type: IntentTargetType.Collection, name: collection },
        { type: IntentTargetType.Game, name },
      ],
      parameters: [],
    } as any);
  }
}

// "dark souls 1" and the model's "Dark Souls" are one game, so nothing gets planned twice.
// "Dark Souls I" (the model) and "dark souls 1" (the message) too.
const baseName = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().replace(/\s+(1|i)$/, "").replace(/\s+/g, "");
const sameName = (a?: string, b?: string) => !!a && !!b && (baseName(a) === baseName(b) || titleMatchScore(a, b) >= 90 || titleMatchScore(b, a) >= 90);

/**
 * "...So should I consider playing ds2 and ds3? If so add them": the message asks something as well
 * as asking for changes. When the model planned only the changes, add a question for answer mode,
 * so the reply answers it instead of ignoring it.
 */
function answerTheQuestionToo(plan: IntentPlan, message: string) {
  if (plan.intents.some((i) => i.type === IntentType.AskQuestion || i.type === IntentType.LibraryQuestion)) return;
  const asks = message
    .split(/(?<=[.?!])\s+|\.\.\.\s*/)
    .some((s) => /\?\s*$/.test(s.trim()) && /\b(should|would|is|are|do|does|can|could|which|what|how|worth|better|harder|easier)\b/i.test(s));
  if (!asks) return;
  plan.intents.push({ type: IntentType.AskQuestion, targets: [], parameters: [] } as any);
}
