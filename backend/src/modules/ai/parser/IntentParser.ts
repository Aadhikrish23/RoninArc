// TEMP DEBUG ONLY

import { LLMIntentResponse } from "../providers/contracts/LLMIntentResponse";
import { validateLLMIntentResponse } from "./IntentValidation";

export class IntentParser {
  /**
   * Extracts, parses, and validates the raw JSON response from the LLM provider into an LLMIntentResponse.
   */
  parse(rawResponse: string): LLMIntentResponse {
    const firstBrace = rawResponse.indexOf("{");
    const lastBrace = rawResponse.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || firstBrace > lastBrace) {
      throw new Error("Could not find a valid JSON object structure in the LLM response.");
    }

    const cleanText = rawResponse.substring(firstBrace, lastBrace + 1).trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleanText);
    } catch (err: any) {
      throw new Error(`Failed to parse LLM JSON: ${err.message}. Original text segment: ${cleanText}`);
    }

    return validateLLMIntentResponse(parsed);
  }
}

export default new IntentParser();
