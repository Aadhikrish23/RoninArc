import { IntentPlan } from "../../../intent/IntentPlan";
import { IntentType } from "../intent/IntentType";
import { IntentParameterType } from "../../../intent/IntentParameterType";
import { IntentTargetType } from "../../../intent/IntentTargetType";
import { namedTitles } from "../conversation/TargetGrounding";
import { namedCollection } from "../conversation/FollowUps";
import { titleMatchScore } from "../../../../rawg/titleMatch";

/**
 * Words that have to be in the user's message for each status. "ok put elden ring and hollow
 * knight in soulslike, and pause rdr2" came back as "Hollow Knight -> Plan to Play" (and on the
 * follow-up, "Hollow Knight -> Paused"): a completed game overwritten by nothing the user said.
 */
const EVIDENCE: Record<string, RegExp> = {
  plan: /\b(plan\w*|backlog|later|queue|wishlist|not started|haven'?t started|havent started|someday|to play)\b/i,
  playing: /\b(play\w*|start\w*|resum\w*|unpaus\w*|continu\w*|back (in)?to it|going in|jump(ing)? (back )?in)\b/i,
  paused: /\b(paus\w*|break|on hold|shelv\w*)\b/i,
  completed: /\b(finish\w*|beat\w*|complet\w*|complted|done|100%?d?|credits|platinum\w*|cleared)\b/i,
  dropped: /\b(drop\w*|quit\w*|gave up|giving up|abandon\w*|uninstall\w*|over it)\b/i,
  none: /\b(no status|clear( the)? status|reset( the)? status|unmark\w*)\b/i,
};

const clausesOf = (message: string) => message.split(/[,;.!?]+\s*|\s+(?:and|also|plus|then|but)\s+/i).filter((c) => c.trim());

/**
 * Drops status changes the message gives no reason for. The evidence has to be in the clause that
 * names the game when one does ("pause rdr2" doesn't pause Hollow Knight named in another clause);
 * a game referred to as "it" is checked against the whole message.
 */
export function dropUnstatedStatusChanges(plan: IntentPlan, message: string, owned: string[]): number {
  const clauses = clausesOf(message);
  const before = plan.intents.length;
  plan.intents = plan.intents.filter((intent) => {
    if (intent.type !== IntentType.SetStatus) return true;
    const status = String(intent.parameters?.find((p) => p.type === IntentParameterType.Status)?.value ?? "").toLowerCase();
    const evidence = EVIDENCE[status];
    if (!evidence) return true;
    const title = intent.targets?.find((t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library)?.name ?? "";
    const own = clauses.filter((c) => title && namedTitles(c, [title, ...owned.filter((t) => t !== title)])[0] === title);
    if (own.length === 0) return evidence.test(message);
    // "how long is disco elysium? ..., unpause it": the status word can sit in a clause that names
    // no game and points back with "it".
    const pointsBack = clauses.some((c) => evidence.test(c) && namedTitles(c, owned).length === 0);
    return own.some((c) => evidence.test(c)) || pointsBack;
  });
  return before - plan.intents.length;
}

// "no i meant silksong goes in soulslikes": a correction saying where a game belongs.
const GOES_IN = /^(.+?)\s+(?:goes|go|belongs?|should (?:be|go))\s+(?:in|into)\s+(?:my\s+|the\s+)?(.+?)\s*$/i;
const PUT_IN = /\b(?:put|add|throw|chuck|toss|stick|move)\s+(.+?)\s+(?:in|into|to)\s+(?:my\s+|the\s+)?(.+?)\s*$/i;

/**
 * "put elden ring and hollow knight in soulslike" for an existing collection: the clause adds those
 * games to it, whatever else the model planned for them.
 */
export function ensureCollectionAdds(plan: IntentPlan, message: string, owned: string[], collections: string[]) {
  for (const clause of clausesOf(message.replace(/\s+and\s+(?=[^,]*\b(?:in|into)\b)/gi, " & "))) {
    const match = clause.match(PUT_IN) ?? clause.match(GOES_IN);
    if (!match) continue;
    const collection = namedCollection(match[2], collections);
    if (!collection) continue;
    // Names the plan already acts on ("add hades 2 and put it in X": "hades 2" is the new
    // Hades II, not the owned Hades that "hades" also matches).
    const planned = plan.intents
      .filter((i) => i.type === IntentType.AddGame || i.type === IntentType.OrganizeCollection)
      .flatMap((i) => (i.targets ?? []).filter((t) => t.type !== IntentTargetType.Collection).map((t) => t.name));
    const games = match[1]
      .split(/\s*&\s*|\s*,\s*/)
      .map((g) => g.replace(/^(?:add|put|throw|chuck|toss|stick|move)\s+/i, "").trim())
      .filter((g) => !planned.some((name) => titleMatchScore(g, name) >= 90))
      .map((g) => namedTitles(g, owned)[0])
      .filter((g): g is string => !!g);
    for (const game of games) {
      const already = plan.intents.some(
        (i) => i.type === IntentType.OrganizeCollection && i.targets?.some((t) => t.name === game),
      );
      if (already) continue;
      plan.intents.push({
        type: IntentType.OrganizeCollection,
        targets: [
          { type: IntentTargetType.Game, name: game },
          { type: IntentTargetType.Collection, name: collection },
        ],
        parameters: [{ type: IntentParameterType.Boolean, value: true }],
      } as any);
    }
  }
}
