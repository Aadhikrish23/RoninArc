import { IntentPlan } from "../../../intent/IntentPlan";
import { IntentType } from "../../../intent/IntentType";
import { IntentParameterType } from "../../../intent/IntentParameterType";
import { IntentTargetType } from "../../../intent/IntentTargetType";
import { mentions } from "../conversation/TargetGrounding";
import { titleMatchScore } from "../../../../rawg/titleMatch";
import { EXPLICIT_ACTION, PER_GAME_INTENTS, RECOMMEND_ASK, RECORDED_DATA, STATUS_INTENTS } from "./Patterns";

/** StartGame / PauseGame / DropGame become SetStatus with the matching status. */
export function normalizeStatusIntents(plan: IntentPlan) {
  for (const intent of plan.intents ?? []) {
    const implied = STATUS_INTENTS[intent.type];
    if (!implied) continue;
    intent.type = IntentType.SetStatus;
    intent.parameters = intent.parameters ?? [];
    if (!intent.parameters.some((p) => p.type === IntentParameterType.Status)) {
      intent.parameters.push({ type: IntentParameterType.Status, value: implied } as any);
    }
  }
}

/**
 * Final shape of the plan before it runs: the right kind of intent, one game per intent,
 * no redundant steps. `fromModel` steps only apply to plans the model (or pre-routing) made.
 */
export function shapePlan(plan: IntentPlan, message: string, fromModel: boolean) {
  // "any cozy games like stardew" asks for suggestions; the model once turned it into
  // "add Stardew Valley". Without an explicit action word, it's a recommendation.
  if (fromModel && RECOMMEND_ASK.test(message) && !EXPLICIT_ACTION.test(message)) {
    plan.intents = [{ type: IntentType.RecommendGame, targets: [], parameters: [{ type: IntentParameterType.Text, value: message }] } as any];
  }

  // New games start as Plan to Play, so "add X" + "set X to plan" is one action, not two.
  const added = plan.intents.filter((i) => i.type === IntentType.AddGame).map((i) => i.targets?.[0]?.name ?? "");
  plan.intents = plan.intents.filter((i) => {
    if (i.type !== IntentType.SetStatus) return true;
    const status = String(i.parameters?.find((p) => p.type === IntentParameterType.Status)?.value ?? "").toLowerCase();
    const name = i.targets?.[0]?.name ?? "";
    return !(/^plan/.test(status) && added.some((a) => titleMatchScore(a, name) >= 90 || mentions(a, name)));
  });

  // Recommendations read the user's own words too: the model's hint sometimes drops
  // "roguelike" or "under 20 hours", and those drive the filters.
  if (fromModel) {
    for (const intent of plan.intents) {
      if (intent.type !== IntentType.RecommendGame) continue;
      const params = intent.parameters ?? [];
      const text = params.find((p) => p.type === IntentParameterType.Text);
      const hint = typeof text?.value === "string" ? text.value : "";
      const combined = hint.toLowerCase().includes(message.toLowerCase()) ? hint : `${hint} ${message}`.trim();
      intent.parameters = [...params.filter((p) => p !== text), { type: IntentParameterType.Text, value: combined } as any];
    }
  }

  // "put elden ring and hollow knight in soulslike": one intent per game, so none is dropped.
  plan.intents = plan.intents.flatMap((intent) => {
    if (!PER_GAME_INTENTS.has(intent.type)) return [intent];
    const games = (intent.targets ?? []).filter((t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library);
    if (games.length <= 1) return [intent];
    const others = (intent.targets ?? []).filter((t) => !games.includes(t));
    return games.map((g) => ({ ...intent, targets: [...others, g] }));
  });

  // "is silksong worth it?" sometimes comes back as a library question; it's a
  // general one unless it asks about the user's own records.
  if (fromModel) {
    for (const intent of plan.intents) {
      if (intent.type !== IntentType.LibraryQuestion) continue;
      const text = String(intent.parameters?.find((p) => p.type === IntentParameterType.Text)?.value ?? message);
      if (!RECORDED_DATA.test(text)) {
        intent.type = IntentType.AskQuestion;
        intent.parameters = [];
      }
    }
  }
}
