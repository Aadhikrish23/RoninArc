import { IntentPlan } from "../../../intent/IntentPlan";
import { IntentType } from "../intent/IntentType";
import { IntentParameterType } from "../../../intent/IntentParameterType";
import { IntentTargetType } from "../../../intent/IntentTargetType";
import { READ_ONLY } from "../conversation/TargetGrounding";
import { asksToReadNotes, collectionDirection, isQuestionOnly, meansDroppedStatus, statedScore, wasAskedFor } from "../conversation/FollowUps";

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
    const target = plan.intents
      .flatMap((i) => i.targets ?? [])
      .find((t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library);
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
  const direction = collectionDirection(message);
  if (direction) {
    for (const intent of plan.intents) {
      if (intent.type !== IntentType.OrganizeCollection) continue;
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

  return { unrequested };
}
