import { AIToolContext } from "../sdk/AIToolContext";
import { Capability } from "../planning/Capability";

interface FewShotExample {
  id: string;
  capabilityId?: string;
  keywords: string[];
  text: string;
}

export class PromptBuilder {
  private readonly examples: FewShotExample[] = [
    {
      id: "launch",
      capabilityId: "launch-game",
      keywords: ["launch", "start", "run", "play", "open", "again"],
      text: `User Request: Launch Fallout Shelter
Response JSON:
{
  "intents": [
    {
      "type": "LaunchGame",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "complete",
      capabilityId: "complete-game",
      keywords: ["complete", "finish", "done", "ended", "completed"],
      text: `User Request: Complete Fallout Shelter
Response JSON:
{
  "intents": [
    {
      "type": "CompleteGame",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": [
        {
          "type": "Status",
          "value": "completed"
        }
      ]
    }
  ]
}`
    },
    {
      id: "rate",
      capabilityId: "review-game",
      keywords: ["rate", "rating", "score"],
      text: `User Request: Rate Fallout Shelter 9
Response JSON:
{
  "intents": [
    {
      "type": "RateGame",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": [
        {
          "type": "Rating",
          "value": 9
        }
      ]
    }
  ]
}`
    },
    {
      id: "review",
      capabilityId: "review-game",
      keywords: ["review", "opinion", "stars"],
      text: `User Request: Review Fallout Shelter
Response JSON:
{
  "intents": [
    {
      "type": "ReviewGame",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "delete-review",
      capabilityId: "review-game",
      keywords: ["delete", "remove review", "erase review"],
      text: `User Request: Delete my review for Fallout Shelter
Response JSON:
{
  "intents": [
    {
      "type": "DeleteReview",
      "targets": [
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "create-collection",
      capabilityId: "collection",
      keywords: ["create", "collection", "group"],
      text: `User Request: Create RPG Collection
Response JSON:
{
  "intents": [
    {
      "type": "CreateCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "RPG Collection"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "bulk-add",
      capabilityId: "collection",
      keywords: ["add", "all", "collection"],
      text: `User Request: Add all Batman games to Batman Collection
Response JSON:
{
  "intents": [
    {
      "type": "OrganizeCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "Batman Collection"
        },
        {
          "type": "Game",
          "name": "all Batman games"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "bulk-remove",
      capabilityId: "collection",
      keywords: ["remove", "all", "collection"],
      text: `User Request: Remove all Batman games from Batman Collection
Response JSON:
{
  "intents": [
    {
      "type": "OrganizeCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "Batman Collection"
        },
        {
          "type": "Game",
          "name": "all Batman games"
        }
      ],
      "parameters": [
        {
          "type": "Boolean",
          "value": false
        }
      ]
    }
  ]
}`
    },
    {
      id: "connect",
      keywords: ["connect", "disconnect", "sync", "epic", "steam", "gog", "ea", "ubisoft", "xbox"],
      text: `User Request: Connect Epic
Response JSON:
{
  "intents": [
    {
      "type": "ConnectAccount",
      "targets": [
        {
          "type": "Provider",
          "name": "epic"
        }
      ],
      "parameters": [
        {
          "type": "Provider",
          "value": "epic"
        }
      ]
    }
  ]
}`
    },
    {
      id: "add-to-collection",
      capabilityId: "collection",
      keywords: ["add", "collection", "group"],
      text: `User Request: Add Fallout Shelter to RPG Collection
Response JSON:
{
  "intents": [
    {
      "type": "OrganizeCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "RPG Collection"
        },
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": []
    }
  ]
}`
    },
    {
      id: "remove-from-collection",
      capabilityId: "collection",
      keywords: ["remove", "delete", "collection", "group"],
      text: `User Request: Remove Fallout Shelter from RPG Collection
Response JSON:
{
  "intents": [
    {
      "type": "OrganizeCollection",
      "targets": [
        {
          "type": "Collection",
          "name": "RPG Collection"
        },
        {
          "type": "Game",
          "name": "Fallout Shelter"
        }
      ],
      "parameters": [
        {
          "type": "Boolean",
          "value": false
        }
      ]
    }
  ]
}`
    }
  ];

  /**
   * Generates prompt text instructs the model to return an LLMIntentResponse JSON matching player goals using capabilities.
   */
  build(
    request: string,
    context: AIToolContext,
    capabilities: Capability[],
  ): string {
    const requestLower = request.toLowerCase();

    // Determine active capability matches based on keywords
    const isLaunch = requestLower.includes("launch") || requestLower.includes("start") || requestLower.includes("run") || requestLower.includes("play") || requestLower.includes("open") || requestLower.includes("again");
    const isComplete = requestLower.includes("complete") || requestLower.includes("finish") || requestLower.includes("done") || requestLower.includes("ended") || requestLower.includes("completed");
    const isReview = requestLower.includes("rate") || requestLower.includes("review") || requestLower.includes("opinion") || requestLower.includes("stars") || requestLower.includes("rating") || requestLower.includes("score");
    const isCollection = requestLower.includes("collection") || requestLower.includes("group") || requestLower.includes("add") || requestLower.includes("remove") || requestLower.includes("create");
    const isConnect = requestLower.includes("connect") || requestLower.includes("disconnect") || requestLower.includes("sync") || requestLower.includes("epic") || requestLower.includes("steam") || requestLower.includes("gog") || requestLower.includes("ea") || requestLower.includes("ubisoft") || requestLower.includes("xbox");

    const hasAnyMatch = isLaunch || isComplete || isReview || isCollection || isConnect;

    // Filter capabilities based on matched keywords
    const activeCapabilities = capabilities.filter((cap) => {
      if (!hasAnyMatch) return true;
      if (cap.id === "complete-game") return isComplete;
      if (cap.id === "launch-game") return isLaunch;
      if (cap.id === "review-game") return isReview;
      if (cap.id === "collection") return isCollection;
      return true;
    });

    const capabilityDetails = activeCapabilities
      .map(
        (cap) =>
          `- Goal: ${cap.name}\n  Description: ${cap.description}`,
      )
      .join("\n\n");

    // Filter examples based on active capabilities
    const activeExamples = this.examples.filter((ex) => {
      if (!hasAnyMatch) return true;
      if (ex.capabilityId === "complete-game") return isComplete;
      if (ex.capabilityId === "launch-game") return isLaunch;
      if (ex.capabilityId === "review-game") return isReview;
      if (ex.capabilityId === "collection") return isCollection;
      if (!ex.capabilityId && ex.id === "connect") return isConnect;
      return false;
    });

    // Fallback: If no examples matched, include all
    const examplesToUse = activeExamples.length > 0 ? activeExamples : this.examples;

    const fewShotExamplesText = examplesToUse
      .map((ex) => ex.text)
      .join("\n\n");

    return `You are RoninArc AI, an assistant helping users manage their game libraries, collections, reviews, and gaming accounts.

Available Capabilities:
${capabilityDetails}
Note:
- Goal "Complete Game" maps to intent type "CompleteGame" and accepts parameter "Status" (value: "completed").
- Goal "Review Game" maps to intent type "ReviewGame" (for text review comments) or "RateGame" (for numeric 1-10 rating scores).
- If the user specifies a rating number or stars (e.g. "9", "10", "5 stars"), you MUST use intent type "RateGame" and include the "Rating" parameter. If the user only says "Review" without a rating number, use "ReviewGame". If the user asks to delete, remove, or erase their review, use intent type "DeleteReview".
- Goal "Manage Collection" maps to intent type "CreateCollection" or "OrganizeCollection" and accepts Collection and Game targets.

User Context:
- User ID: ${context.userId}

User Request:
${request}

Instruction:
Understand the user request and map it to player-centric intents.
You must return ONLY a valid JSON object matching the following structure without any markdown formatting, explanations, comments, reasoning, or additional text.

Allowed Enum Values:
- intent type: CompleteGame, LaunchGame, RateGame, ReviewGame, DeleteReview, CreateCollection, OrganizeCollection, SyncLibrary, ConnectAccount, DisconnectAccount, AskQuestion, Help
- target type: Game, Collection, Provider, Library, Review
- parameter type: Rating, Status, Platform, Provider, Date, Boolean, Text

Strict Constraints:
1. Output ONLY valid JSON starting with { and ending with }.
2. Never output markdown code fences (e.g. do not wrap response in \`\`\`json or \`\`\`).
3. Never output explanations, comments, corrections, or reasoning.
4. Never output values outside the allowed enums.
5. Never combine enum values (e.g., do not output "Game | Review" or "LaunchGame | StartGame").
6. Use exactly one value for every enum.
7. Preserve user supplied parameter values exactly whenever possible.
8. Even if you think there is an error in the examples or instruction, you MUST NOT output explanations or corrections. You must return ONLY the JSON object.

JSON Structure:
{
  "intents": [
    {
      "type": "<one of the allowed intent types>",
      "targets": [
        {
          "type": "<one of the allowed target types>",
          "name": "<human-readable name>"
        }
      ],
      "parameters": [
        {
          "type": "<one of the allowed parameter types>",
          "value": <string or number or boolean value>
        }
      ]
    }
  ]
}

Few-shot Examples:

${fewShotExamplesText}`;
  }
}

export default new PromptBuilder();

