// TEMP DEBUG ONLY

import { AIToolContext } from "../sdk/AIToolContext";
import { Capability } from "../planning/Capability";

export class PromptBuilder {
  /**
   * Generates prompt text instructs the model to return an LLMIntentResponse JSON matching player goals using capabilities.
   */
  build(
    request: string,
    context: AIToolContext,
    capabilities: Capability[],
  ): string {
    const capabilityDetails = capabilities
      .map(
        (cap) =>
          `- Goal: ${cap.name}\n  Description: ${cap.description}`,
      )
      .join("\n\n");

    return `You are RoninArc AI, an assistant helping users manage their game libraries, collections, reviews, and epic accounts.

Available Capabilities:
${capabilityDetails}

User Context:
- User ID: ${context.userId}

User Request:
${request}

Instruction:
Understand the user request and map it to player-centric intents.
You must return ONLY a valid JSON object matching the following structure without any markdown formatting, explanations, or additional text:
{
  "intents": [
    {
      "type": "StartGame | CompleteGame | LaunchGame | RateGame | ReviewGame | CreateCollection | OrganizeCollection | SyncLibrary | ConnectAccount | DisconnectAccount | AskQuestion | Help",
      "targets": [
        {
          "type": "Game | Collection | Provider | Library | Review",
          "name": "human-readable name"
        }
      ],
      "parameters": [
        {
          "type": "Rating | Status | Platform | Provider | Date | Boolean | Text",
          "value": "string or number or boolean value"
        }
      ]
    }
  ]
}`;
  }
}

export default new PromptBuilder();
