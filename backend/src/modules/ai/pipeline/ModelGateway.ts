import { AIProvider } from "../providers/AIProvider";
import { CapabilityRegistry } from "../planning/CapabilityRegistry";
import { IntentPlan } from "../intent/IntentPlan";
import { CLAIMS_ACTION } from "./Patterns";
import { expandAbbreviation } from "../../rawg/gameAbbreviations";

/**
 * "is elden ring harder than ds3?" -> "... than ds3 (Dark Souls III)?": the answer model read
 * "ds3" as "Demon Slayer 3". Known game shorthand is spelled out before it sees the question.
 */
export function spellOutShorthand(question: string): string {
  // Words like "ds3", "botw", "rdr 2", "gta 5" -- letters with an optional (spaced) number.
  return question.replace(/\b[a-z]{2,6}(?:\s?\d{1,2})?\b/gi, (word) => {
    const full = expandAbbreviation(word);
    return full && full.toLowerCase() !== word.toLowerCase() ? `${word} (${full})` : word;
  });
}

/** The two kinds of model call the runtime makes: planning actions and answering questions. */
export class ModelGateway {
  constructor(
    private readonly provider: AIProvider,
    private readonly capabilityRegistry: CapabilityRegistry,
  ) {}

  /** The planner occasionally returns malformed JSON; one retry usually fixes it. */
  async planWithRetry(request: string, context: any): Promise<IntentPlan> {
    try {
      return await this.provider.plan(request, context, this.capabilityRegistry.list());
    } catch (error: any) {
      if (error?.code !== "PROVIDER_VALIDATION_ERROR") throw error;
      // At temperature 0 the same prompt gives the same broken reply, so the retry leaves out
      // the recent conversation (the model once looped on its own earlier replies).
      return this.provider.plan(request, { ...context, recentExchanges: [] }, this.capabilityRegistry.list());
    }
  }

  /**
   * Answer mode can't change anything, but the model once replied "I've added Elden Ring ... and
   * included it in the Soulslikes collection" when nothing ran. A reply claiming an action is replaced.
   */
  async answerSafely(question: string, context: any): Promise<string> {
    const answer = await this.provider.answer(spellOutShorthand(question), context);
    if (CLAIMS_ACTION.test(answer)) {
      return "I didn't change anything with that message. Tell me what you'd like done, like \"add Elden Ring to Soulslikes\", and I'll do it.";
    }
    return answer;
  }
}
