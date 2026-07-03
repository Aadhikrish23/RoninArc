import { AIToolContext } from "../sdk/AIToolContext";
import { Capability } from "../planning/Capability";
import { IntentPlan } from "../intent/IntentPlan";

export interface AIProvider {
  plan(
    request: string,
    context: AIToolContext,
    capabilities: Capability[],
  ): Promise<IntentPlan>;
}
