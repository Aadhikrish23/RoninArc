import { IntentPlan } from "../../../intent/IntentPlan";
import { IntentType } from "../intent/IntentType";
import { IntentParameterType } from "../../../intent/IntentParameterType";
import { IntentTargetType } from "../../../intent/IntentTargetType";
import { dropUngroundedIntents, mentions, sameGame } from "../conversation/TargetGrounding";
import { existingReviewText } from "../conversation/DirectActions";
import type { Exchange } from "../../../conversation/RecentExchanges";
import { titleMatchScore } from "../../../../rawg/titleMatch";
import { AUTO_ADD_FOR, REWRITES_REVIEW } from "./Patterns";

/** Comment text that's really the command: "bump my rating to an 8", "mark it done n rate it 9". */
export const INSTRUCTION_TEXT = /\b(my rating|rating to|rate it|rated it|score it|bump|mark it|set it|change it|give it|out of 10)\b|\b\d+(\.5)?\s*\/\s*10\b/i;

export interface GroundingResult {
  /** Changes dropped because the message didn't name or refer to their game. */
  ungrounded: number;
  /** Games a change was aimed at that aren't in the library (and can't be auto-added). */
  skippedMissing: string[];
  /** Games whose hand-written review was kept instead of replaced by a rating comment. */
  keptReviews: string[];
}

interface GroundingInput {
  userId: string;
  message: string;
  owned: string[];
  lastExchange?: Exchange;
  currentGame: string | null;
  pageGame: string | null;
}

/**
 * Ties the plan to real games: only games the user named or clearly referred to,
 * comments from the user's own words, no overwriting a written review, and games
 * that aren't owned yet added first.
 */
export async function groundPlan(plan: IntentPlan, { userId, message, owned, lastExchange, currentGame, pageGame }: GroundingInput): Promise<GroundingResult> {
  const keptReviews: string[] = [];
  const skippedMissing: string[] = [];

  const ungrounded = dropUngroundedIntents(plan, {
    message,
    recentText: lastExchange ? `${lastExchange.user} ${lastExchange.assistant}` : "",
    // "it" can't point at a game that has since been removed.
    currentGame: currentGame && owned.some((t) => titleMatchScore(currentGame, t) >= 90 || mentions(currentGame, t)) ? currentGame : null,
    owned,
    pageGame,
  });

  // A review comment must come from the user's own words, not the prompt's examples
  // (the model once attached "it was amazing" to a plain "rate hollow knight 9").
  const said = new Set(message.toLowerCase().match(/[a-z']+/g) ?? []);
  for (const intent of plan.intents) {
    if (intent.type !== IntentType.RateGame && intent.type !== IntentType.ReviewGame) continue;
    intent.parameters = (intent.parameters ?? []).filter((p) => {
      if (p.type !== IntentParameterType.Text || typeof p.value !== "string") return true;
      const words = p.value.toLowerCase().match(/[a-z']+/g) ?? [];
      // "bump my rating to an 8" is the instruction, not a review ("it was amazing" is one).
      if (INSTRUCTION_TEXT.test(p.value)) return false;
      return words.length > 0 && words.filter((w) => said.has(w)).length / words.length >= 0.6;
    });
  }

  // "rate hollow knight 9 it was amazing" changes the score; it must not replace a review
  // the user wrote by hand. Only "review X: ..." / "change my review to ..." rewrites it.
  if (!REWRITES_REVIEW.test(message)) {
    for (const intent of plan.intents) {
      if (intent.type !== IntentType.RateGame && intent.type !== IntentType.ReviewGame) continue;
      const comment = (intent.parameters ?? []).find((p) => p.type === IntentParameterType.Text);
      const title = intent.targets?.find((t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library)?.name;
      if (!comment || !title) continue;
      const existing = await existingReviewText(userId, title);
      if (existing && existing.trim() !== String(comment.value).trim()) {
        intent.parameters = (intent.parameters ?? []).filter((p) => p !== comment);
        keptReviews.push(title);
      }
    }
  }

  // Games being added in this same message count as owned for the steps after.
  const adding = plan.intents
    .filter((i) => i.type === IntentType.AddGame)
    .map((i) => i.targets?.[0]?.name ?? "")
    .filter(Boolean);
  const isOwned = (name: string) => [...owned, ...adding].some((t) => sameGame(name, t));

  // "I'm playing sekiro" / "rate celeste 9" for a game not in the library yet: add it first.
  // Anything else aimed at a missing game is skipped with a note, so the rest still runs.
  const next: typeof plan.intents = [];
  for (const intent of plan.intents) {
    const missing = (intent.targets ?? []).filter((t) => t.type === IntentTargetType.Game && t.name && !isOwned(t.name));
    if (missing.length === 0 || intent.type === IntentType.AddGame) {
      next.push(intent);
    } else if (AUTO_ADD_FOR.has(intent.type) || isCollectionAdd(intent)) {
      for (const m of missing) {
        const alreadyAdding = next.some((i) => i.type === IntentType.AddGame && i.targets?.some((t) => titleMatchScore(t.name ?? "", m.name) >= 90));
        if (!alreadyAdding) next.push({ ...intent, type: IntentType.AddGame, targets: [{ type: IntentTargetType.Library, name: m.name }], parameters: [] } as any);
      }
      next.push(intent);
    } else {
      skippedMissing.push(...missing.map((m) => m.name));
    }
  }
  plan.intents = next;

  // "finished X" for a game already owned: no need to re-add it before changing its status.
  const changed = plan.intents.filter((i) => i.type !== IntentType.AddGame);
  plan.intents = plan.intents.filter((i) => {
    if (i.type !== IntentType.AddGame || changed.length === 0) return true;
    const name = i.targets?.[0]?.name ?? "";
    const ownedAlready = owned.some((t) => sameGame(name, t));
    const touchedLater = changed.some((c) => (c.targets ?? []).some((t) => titleMatchScore(t.name ?? "", name) >= 90 || mentions(t.name ?? "", name)));
    return !(ownedAlready && touchedLater);
  });

  return { ungrounded, skippedMissing, keptReviews };
}

/** "put ds3 in soulslikes" for a game not in the library: add it, then put it in. */
function isCollectionAdd(intent: any): boolean {
  if (intent.type !== IntentType.OrganizeCollection) return false;
  const flag = (intent.parameters ?? []).find((p: any) => String(p.type).toLowerCase() === "boolean");
  return !flag || (flag.value !== false && flag.value !== "false");
}
