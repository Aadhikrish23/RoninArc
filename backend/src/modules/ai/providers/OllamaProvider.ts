// TEMP DEBUG ONLY

import { AIProvider } from "./AIProvider";
import { AIToolContext } from "../sdk/AIToolContext";
import { Capability } from "../planning/Capability";
import { IntentPlan } from "../intent/IntentPlan";
import promptBuilder from "../prompts/PromptBuilder";
import ollamaClient from "../clients/OllamaClient";
import intentParser from "../parser/IntentParser";
import intentNormalizer from "../intent/IntentNormalizer";
import aiTraceLogger from "../debug/AITraceLogger";

export class OllamaProvider implements AIProvider {
  async plan(
    request: string,
    context: AIToolContext,
    capabilities: Capability[],
  ): Promise<IntentPlan> {
    const trace = aiTraceLogger.current();
    const startTime = Date.now();

    try {
      const prompt = promptBuilder.build(request, context, capabilities);
      if (trace) {
        trace.log("Provider", "Prompt Generated", {
          model: "gemma3:4b",
          promptLength: prompt.length,
          capabilityCount: capabilities.length,
          requestLength: request.length,
          ...(process.env.DEBUG_AI === "true" ? { fullPrompt: prompt } : {}),
        });
      }
      
      const rawResponse = await ollamaClient.generate(prompt);
      if (trace) {
        trace.log("Provider", "Raw LLM Response Received", {
          characterCount: rawResponse.length,
          ...(process.env.DEBUG_AI === "true" ? { fullResponse: rawResponse } : {}),
        });
      }

      const llmIntentResponse = intentParser.parse(rawResponse);
      if (trace) {
        trace.log("Provider", "LLMIntentResponse", llmIntentResponse);
      }

      const parsedPlan = intentNormalizer.normalize(llmIntentResponse, context.requestId || "");
      if (trace) {
        const elapsed = Date.now() - startTime;
        trace.log("Provider", "Normalized IntentPlan", parsedPlan, elapsed);
        
        // Update trace statistics summary
        trace.updateStats({
          intentCount: parsedPlan.intents?.length || 0,
        });
      }

      return parsedPlan;
    } catch (error) {
      if (trace) {
        trace.error("Provider", error);
      }
      throw error;
    }
  }
}
