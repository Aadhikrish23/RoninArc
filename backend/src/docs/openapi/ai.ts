import { appError, bearerAuth, jsonBody, objectId, ok, okMessage, pathParam, queryParam, ref, responses, type Schema } from "./common";

export const aiSchemas: Record<string, Schema> = {
  AIChatRequest: {
    type: "object",
    required: ["message"],
    properties: {
      message: { type: "string", minLength: 1, example: "What should I play next?" },
      client: {
        type: "object",
        description:
          "What the calling app can do itself. Send `canLaunchGames: true` only from the desktop app; anything else (or omitting it) means launch requests are answered with an explanation instead of a `launch_game` client action.",
        properties: {
          canLaunchGames: { type: "boolean", default: false },
          pageGameId: {
            type: "string",
            pattern: "^[A-Za-z0-9]{1,40}$",
            description: "The game page the user has open (library id or RAWG id), so \"add this game to cozy nights\" means that game.",
          },
          pageCollectionId: { type: "string", pattern: "^[A-Za-z0-9]{1,40}$", description: "The collection page the user has open." },
        },
      },
    },
  },
  AIChatResponse: {
    type: "object",
    description:
      "The assistant's reply. `success` is false for failed actions and for clarification questions (`status: CLARIFICATION_REQUIRED`) -- reply with the answer as the next message.",
    required: ["success", "message"],
    properties: {
      success: { type: "boolean" },
      message: { type: "string", description: "Text to show the user." },
      status: {
        type: "string",
        enum: ["SUCCESS", "PARTIAL_SUCCESS", "PARTIAL", "FAILED", "CLARIFICATION_REQUIRED", "CONFIRMATION_REQUIRED", "CANCELLED", "LIMITED"],
        description: "CONFIRMATION_REQUIRED: the assistant asks before removing games; reply \"yes\" to go ahead or \"no\" to keep them. CANCELLED: the user said no. PARTIAL: part of a two-part message ran and the rest timed out. LIMITED: the daily AI allowance is used up (resets at midnight UTC).",
      },
      clarificationRequest: {
        type: "object",
        description: "Present when the assistant needs more information.",
        properties: {
          id: { type: "string" },
          type: { type: "string", example: "MISSING_PARAMETER" },
          question: { type: "string" },
          reason: { type: "string" },
          entityType: { type: "string" },
          options: { type: "array", items: { type: "object" } },
        },
      },
      errors: { type: "array", items: { type: "string" } },
      clientActions: {
        type: "array",
        description:
          "Work only the app can do, present when non-empty. `launch_game`: start this library game with the app's normal launch flow (which starts and ends the play session). The server never starts games or play sessions itself.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "gameId", "title"],
          properties: {
            type: { const: "launch_game" },
            gameId: { ...objectId, description: "Library game id." },
            title: { type: "string", example: "Hades" },
          },
        },
      },
      metrics: { type: "object", description: "Per-layer timings in milliseconds.", additionalProperties: true },
    },
  },
  AIChatInvalid: {
    type: "object",
    required: ["success", "message"],
    properties: { success: { const: false }, message: { type: "string" } },
  },
  AIOffline: {
    type: "object",
    required: ["success", "offline", "message"],
    properties: { success: { const: false }, offline: { const: true }, message: { type: "string" } },
  },
  Recommendation: {
    type: "object",
    required: ["source", "title", "genres", "score", "reasons"],
    properties: {
      source: { type: "string", enum: ["library", "rawg"], description: "`library` = from the user's backlog, `rawg` = a new game." },
      gameId: { ...objectId, description: "Library game id (backlog picks only)." },
      rawgId: { type: "integer" },
      title: { type: "string", example: "Celeste" },
      imageURL: { type: "string" },
      genres: { type: "array", items: { type: "string" } },
      status: ref("ProgressStatus"),
      released: { type: "string" },
      score: { type: "integer", minimum: 0, maximum: 100, description: "How well it fits the user's taste." },
      reasons: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
        example: ["Platformer, like Hollow Knight -- you rated Hollow Knight 9/10", "Critically acclaimed (Metacritic 92)"],
      },
    },
  },
  RecommendationResult: {
    type: "object",
    required: ["profile", "focus", "backlog", "discover"],
    properties: {
      profile: {
        type: "object",
        required: ["personalized", "signalCount", "topGenres"],
        properties: {
          personalized: { type: "boolean", description: "False until the user has rated, finished, dropped or played something." },
          signalCount: { type: "integer", description: "Games that informed the taste profile." },
          topGenres: {
            type: "array",
            items: {
              type: "object",
              required: ["genre", "affinity"],
              properties: { genre: { type: "string" }, affinity: { type: "number", minimum: -1, maximum: 1 } },
            },
          },
        },
      },
      focus: { type: "array", items: { type: "string" }, description: "Genres derived from the `q` hint." },
      backlog: { type: "array", items: ref("Recommendation") },
      discover: { type: "array", items: ref("Recommendation") },
      discoverError: { type: "string", description: "Set when RAWG was unreachable; backlog picks are still returned." },
    },
  },
};

export const aiPaths = {
  "/ai/chat": {
    post: {
      tags: ["AI assistant"],
      summary: "Send a message to the AI assistant",
      description:
        "Natural-language library control: launch, complete, rate/review, add/remove/search games, notes, collections, store connections and recommendations. Greetings are answered without the model. Requests from one user are processed one at a time.",
      security: bearerAuth,
      requestBody: jsonBody(ref("AIChatRequest"), { message: "Rate Hades 9" }),
      responses: {
        200: {
          description: "The assistant's reply (including failed actions and clarification questions).",
          content: {
            "application/json": {
              schema: ref("AIChatResponse"),
              examples: {
                action: { value: { success: true, status: "SUCCESS", message: "I've posted your 9-star review for Hades." } },
                clarification: {
                  value: {
                    success: false,
                    status: "CLARIFICATION_REQUIRED",
                    message: "What status should I update the game to?",
                    clarificationRequest: { type: "MISSING_PARAMETER", question: "What status should I update the game to?" },
                  },
                },
              },
            },
          },
        },
        400: {
          description: "Empty message, or the assistant's runtime rejected the request.",
          content: {
            "application/json": {
              schema: { oneOf: [ref("AIChatInvalid"), ref("AppError")] },
              example: { success: false, message: "Please tell me what you'd like to do." },
            },
          },
        },
        401: responses.unauthorized,
        503: {
          description: "The AI model can't be reached (no internet, or Ollama/NVIDIA unavailable). Everything else keeps working.",
          content: {
            "application/json": {
              schema: ref("AIOffline"),
              example: {
                success: false,
                offline: true,
                message:
                  "The AI assistant is offline right now. Check your internet connection and try again -- everything else in RoninArc keeps working.",
              },
            },
          },
        },
      },
    },
  },
  "/ai/reset": {
    post: {
      tags: ["AI assistant"],
      summary: "Clear the conversation",
      description:
        "What \"Clear\" in the chat does: forgets recent exchanges, any removal waiting for a yes/no, and what \"it\" refers to. Library data is untouched.",
      security: bearerAuth,
      responses: {
        200: okMessage("Conversation cleared.", "Conversation cleared"),
        401: responses.unauthorized,
      },
    },
  },
  "/recommendations": {
    get: {
      tags: ["Recommendations"],
      summary: "Personalised game recommendations",
      description:
        "Ranks the user's unfinished backlog (works offline) and unowned RAWG games in their favourite genres, using ratings, completions, drops and playtime. Every pick has a 0-100 match score and reasons.",
      security: bearerAuth,
      parameters: [
        queryParam("type", "Which lists to compute.", { type: "string", enum: ["all", "backlog", "discover"], default: "all" }),
        queryParam("limit", "Maximum picks per list.", { type: "integer", minimum: 1, maximum: 20, default: 6 }),
        queryParam("q", 'Optional hint, e.g. "like Hades" or "a platformer" (max 200 chars).', { type: "string" }),
      ],
      responses: {
        200: ok("Recommendations.", ref("RecommendationResult")),
        400: appError("Invalid `type` or `limit`.", "type must be one of: all, backlog, discover", "limit must be a whole number from 1 to 20"),
        401: responses.unauthorized,
      },
    },
  },
  "/recommendations/dismiss": {
    post: {
      tags: ["Recommendations"],
      summary: "Mark a game as not interesting",
      description: "Stops a RAWG game from being suggested. Idempotent.",
      security: bearerAuth,
      requestBody: jsonBody(
        {
          type: "object",
          required: ["rawgId"],
          properties: { rawgId: { type: "integer", minimum: 1 }, title: { type: "string" } },
        },
        { rawgId: 28, title: "Celeste" },
      ),
      responses: {
        200: okMessage("Dismissed.", "Recommendation dismissed"),
        400: appError("Missing/invalid rawgId or title.", "A valid rawgId is required", "title must be text"),
        401: responses.unauthorized,
      },
    },
  },
  "/recommendations/dismiss/{rawgId}": {
    delete: {
      tags: ["Recommendations"],
      summary: "Undo a dismissal",
      security: bearerAuth,
      parameters: [pathParam("rawgId", "RAWG game id.", { type: "string", pattern: "^\\d+$" })],
      responses: {
        200: okMessage("Restored.", "Recommendation restored"),
        400: appError("Invalid rawgId.", "A valid rawgId is required"),
        401: responses.unauthorized,
        404: appError("It wasn't dismissed.", "That game wasn't dismissed"),
      },
    },
  },
};
