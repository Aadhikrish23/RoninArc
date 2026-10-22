import type { ToolCapability } from "../../../execution/ToolCapability";
import type { ExecutionStep } from "../../../execution/ExecutionStep";
import type { DomainTools } from "../../../domain/DomainPack";
import { collectionDirectionFor } from "../conversation/FollowUps";

/** The model says "Paused", "on hold", "plan to play", "beaten"...; the library stores six values. */
export function normalizeStatus(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/[_-]+/g, " ");
  if (/^(none|no status|unset|clear)$/.test(s)) return "none";
  if (/pause|hold|break/.test(s)) return "paused";
  if (/drop|abandon|quit|gave up/.test(s)) return "dropped";
  if (/complete|finish|beat|done/.test(s)) return "completed";
  if (/plan|backlog|want|wishlist|later|to play/.test(s)) return "plan";
  if (/play|start|progress|current/.test(s)) return "playing";
  return s;
}

/** "it was amazing" is a comment; "9", "hollow knight 9" or "rate hollow knight 9" are not. */
function isRealComment(text: unknown, gameName?: string): boolean {
  if (typeof text !== "string") return false;
  let rest = text.toLowerCase();
  if (gameName) rest = rest.split(gameName.toLowerCase()).join(" ");
  rest = rest.replace(/\b(rate|rating|rated|review|give|it|a|an|out of|stars?|10)\b/g, " ").replace(/[\d./]+/g, " ");
  return /[a-z]{2,}/.test(rest);
}

const metadata: ToolCapability[] = [
  {
    id: "launch_game",
    supportedIntent: "launch_game",
    supportedEntityTypes: ["Game"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["gameId"],
    optionalParameters: [],
    description: "Launches a game in the user library",
    parameters: [
      { name: "gameId", type: "string", required: true },
    ],
  },
  {
    id: "install_game",
    supportedIntent: "install_game",
    supportedEntityTypes: ["Game"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["gameId"],
    optionalParameters: [],
    description: "Installs a game",
    parameters: [
      { name: "gameId", type: "string", required: true },
    ],
  },
  {
    id: "create_collection",
    supportedIntent: "create_collection",
    supportedEntityTypes: ["Collection"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["name"],
    optionalParameters: [],
    description: "Creates a new game collection",
    parameters: [
      { name: "name", type: "string", required: true },
    ],
  },
  {
    id: "add_to_collection",
    supportedIntent: "add_to_collection",
    supportedEntityTypes: ["Collection", "Game"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["collectionName", "gameId"],
    optionalParameters: [],
    description: "Adds a game to a collection",
    parameters: [
      { name: "collectionName", type: "string", required: true },
      { name: "gameId", type: "string", required: true },
    ],
  },
  {
    id: "remove_from_collection",
    supportedIntent: "remove_from_collection",
    supportedEntityTypes: ["Collection", "Game"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["collectionName", "gameId"],
    optionalParameters: [],
    description: "Removes a game from a collection",
    parameters: [
      { name: "collectionName", type: "string", required: true },
      { name: "gameId", type: "string", required: true },
    ],
  },
  {
    id: "add_game",
    supportedIntent: "add_game",
    supportedEntityTypes: ["Library"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["gameName"],
    optionalParameters: [],
    description: "Searches RAWG and adds a game to the user's library",
    parameters: [
      { name: "gameName", type: "string", required: true },
    ],
  },
  {
    id: "remove_game",
    supportedIntent: "remove_game",
    supportedEntityTypes: ["Game"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["gameId"],
    optionalParameters: [],
    description: "Removes a game from the user's library",
    parameters: [
      { name: "gameId", type: "string", required: true },
    ],
  },
  {
    id: "search_library",
    supportedIntent: "search_library",
    supportedEntityTypes: [],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["searchValue"],
    optionalParameters: ["searchParam"],
    description: "Searches the user's library by title, tag, or status",
    parameters: [
      { name: "searchValue", type: "string", required: true },
      { name: "searchParam", type: "string", required: false },
    ],
  },
  {
    id: "add_note",
    supportedIntent: "add_note",
    supportedEntityTypes: ["Game"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["gameId", "content"],
    optionalParameters: [],
    description: "Adds a personal note to a game",
    parameters: [
      { name: "gameId", type: "string", required: true },
      { name: "content", type: "string", required: true },
    ],
  },
  {
    id: "recommend_games",
    supportedIntent: "recommend_games",
    supportedEntityTypes: [],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: [],
    optionalParameters: ["query"],
    description: "Suggests what to play next and new games to discover",
    parameters: [
      { name: "query", type: "string", required: false },
    ],
  },
  {
    id: "library_question",
    supportedIntent: "library_question",
    supportedEntityTypes: [],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: [],
    optionalParameters: ["question"],
    description: "Answers questions about the user's library",
    parameters: [
      { name: "question", type: "string", required: false },
    ],
  },
  {
    id: "update_status",
    supportedIntent: "update_status",
    supportedEntityTypes: ["Game"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["gameId", "status"],
    optionalParameters: [],
    description: "Updates game library play status",
    parameters: [
      { name: "gameId", type: "string", required: true },
      { name: "status", type: "string", required: true },
    ],
  },
  {
    id: "create_review",
    supportedIntent: "create_review",
    supportedEntityTypes: ["Game"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["gameId", "rating"],
    optionalParameters: ["reviewText"],
    description: "Creates a review for a game",
    parameters: [
      { name: "gameId", type: "string", required: true },
      { name: "rating", type: "number", required: true },
      { name: "reviewText", type: "string", required: false },
    ],
  },
  {
    id: "delete_review",
    supportedIntent: "delete_review",
    supportedEntityTypes: ["Game"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: ["gameId"],
    optionalParameters: [],
    description: "Deletes a review for a game",
    parameters: [
      { name: "gameId", type: "string", required: true },
    ],
  },
  {
    id: "connect_epic",
    supportedIntent: "connect_epic",
    supportedEntityTypes: ["Provider"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: [],
    optionalParameters: ["authorizationCode", "localGames"],
    description: "Connects Epic Games account",
    parameters: [
      { name: "authorizationCode", type: "string", required: false },
      { name: "localGames", type: "object", required: false },
    ],
  },
  {
    id: "disconnect_epic",
    supportedIntent: "disconnect_epic",
    supportedEntityTypes: ["Provider"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: [],
    optionalParameters: [],
    description: "Disconnects Epic Games account",
    parameters: [],
  },
  {
    id: "sync_epic",
    supportedIntent: "sync_epic",
    supportedEntityTypes: ["Provider"],
    executionPolicy: "SEQUENTIAL",
    requiredParameters: [],
    optionalParameters: ["localGames"],
    description: "Syncs Epic Games library",
    parameters: [
      { name: "localGames", type: "object", required: false },
    ],
  },
];

function chooseTool(capabilityId: string, targetsOrInput?: any[] | Record<string, unknown>, queryOrIntentType?: string): string | undefined {
  if (capabilityId === "review-game") {
    const queryText = (queryOrIntentType || "").toLowerCase();
    // A rating is never a delete: "get rid of cod mw2 and give gta 5 an 8" rated nothing and
    // answered "Review not found." because the message's "remove" picked delete_review.
    const params = Array.isArray(targetsOrInput) ? [] : ((targetsOrInput as any)?.parameters ?? []);
    if (Array.isArray(params) && params.some((p: any) => String(p?.type ?? "").toLowerCase() === "rating")) {
      return "create_review";
    }
    if (
      queryText.includes("delete") ||
      queryText.includes("remove") ||
      queryText.includes("erase")
    ) {
      return "delete_review";
    }
    return "create_review";
  }

  if (capabilityId === "collection") {
    let targets: any[] = [];
    let parameters: any[] = [];
    if (Array.isArray(targetsOrInput)) {
      targets = targetsOrInput;
    } else if (targetsOrInput && typeof targetsOrInput === "object") {
      targets = (targetsOrInput.targets as any[]) || [];
      const raw = (targetsOrInput as any).parameters;
      parameters = Array.isArray(raw) ? raw : [];
    }

    const hasGame = targets.some((t) => t.type === "Game" || t.type?.toLowerCase() === "game");

    // The intent's own Boolean says add (true/absent) or remove (false), so
    // "take X out and add Y" maps each part correctly instead of using the
    // whole message's keywords for both.
    const flag = parameters.find((p) => p && String(p.type).toLowerCase() === "boolean");
    if (hasGame && flag) {
      return flag.value === false || flag.value === "false" ? "remove_from_collection" : "add_to_collection";
    }

    const queryTextForCreate = (queryOrIntentType || "").toLowerCase();
    if (queryTextForCreate.includes("create") && !hasGame) {
      return "create_collection";
    }

    if (hasGame) {
      const queryText = (queryOrIntentType || "").toLowerCase();
      // "silksong goes in soulslikes, not stardew. take stardew out of there": each game is
      // added or removed by what its own part of the message says, not the whole message.
      const game = targets.find((t) => t.type === "Game" || t.type?.toLowerCase() === "game");
      const own = collectionDirectionFor(queryText, String(game?.name ?? ""));
      if (own) return own === "remove" ? "remove_from_collection" : "add_to_collection";
      if (
        queryText.includes("remove") ||
        queryText.includes("delete") ||
        queryText.includes("erase") ||
        queryText.includes("drop") ||
        queryText.includes("take out") ||
        /\btake .+ out\b/.test(queryText) ||
        queryText.includes("out of") ||
        queryText.includes("withdraw") ||
        queryText.includes("removefromcollection")
      ) {
        return "remove_from_collection";
      }
      return "add_to_collection";
    }
    return "create_collection";
  }
  return undefined;
}

function buildInput(step: ExecutionStep): Record<string, unknown> | undefined {
  const targets = (step.input.targets as any[]) || [];
  const parameters = step.input.parameters || {};
  const capabilityId = step.input.capabilityId as string;

  const gameTarget = targets.find((t) => t.type === "Game" || t.type?.toLowerCase() === "game");
  const collectionTarget = targets.find((t) => t.type === "Collection" || t.type?.toLowerCase() === "collection");
  const libraryTarget = targets.find((t) => t.type === "Library" || t.type?.toLowerCase() === "library");

  const getParamValue = (name: string, type: string) => {
    if (Array.isArray(parameters)) {
      const found = parameters.find((p: any) => p && (p.name === name || p.type === type));
      return found ? found.value : undefined;
    }
    const record = parameters as Record<string, unknown>;
    return record[name] !== undefined ? record[name] : record[type.toLowerCase()];
  };

  switch (step.toolName) {
    case "update_status": {
      let progressStatus = "plan";
      if (capabilityId === "complete-game") {
        progressStatus = "completed";
      } else {
        const statusVal = getParamValue("status", "Status");
        if (statusVal !== undefined) {
          progressStatus = normalizeStatus(String(statusVal));
        }
      }

      const gameIdVal = getParamValue("gameId", "GameId") || getParamValue("gameId", "gameId");
      return {
        gameId: gameIdVal !== undefined ? String(gameIdVal) : (gameTarget ? gameTarget.name : ""),
        progressStatus,
      };
    }

    case "create_review":
    case "update_review": {
      const ratingVal = getParamValue("rating", "Rating");
      const textVal = getParamValue("reviewText", "Text");
      const gameIdVal = getParamValue("gameId", "GameId") || getParamValue("gameId", "gameId");
      return {
        gameId: gameIdVal !== undefined ? String(gameIdVal) : (gameTarget ? gameTarget.name : ""),
        // No made-up default: a missing rating is asked for, not saved as 5.
        rating: ratingVal !== undefined ? Number(ratingVal) : undefined,
        // Undefined keeps whatever review text is already there. Text that only
        // repeats the request ("hollow knight 9") is not a comment.
        reviewText: isRealComment(textVal, gameTarget?.name) ? String(textVal).trim() : undefined,
      };
    }

    case "delete_review": {
      const gameIdVal = getParamValue("gameId", "GameId") || getParamValue("gameId", "gameId");
      return {
        gameId: gameIdVal !== undefined ? String(gameIdVal) : (gameTarget ? gameTarget.name : ""),
      };
    }

    case "add_game": {
      const nameVal = getParamValue("gameName", "Text");
      return {
        gameName: nameVal !== undefined ? String(nameVal) : (libraryTarget ? libraryTarget.name : ""),
      };
    }

    case "remove_game": {
      const gameIdVal = getParamValue("gameId", "GameId") || getParamValue("gameId", "gameId");
      return {
        gameId: gameIdVal !== undefined ? String(gameIdVal) : (gameTarget ? gameTarget.name : ""),
      };
    }

    case "search_library": {
      const searchValueVal = getParamValue("searchValue", "Text");
      const searchParamVal = getParamValue("searchParam", "Status");
      return {
        searchValue: searchValueVal !== undefined ? String(searchValueVal) : "",
        // Leave searchParam unset when the LLM didn't supply one -- forcing
        // a default here (this used to default to "tags") overrides
        // SearchLibraryTool's own, better fallback of searching every
        // allowed field when the field to search wasn't specified.
        searchParam: searchParamVal !== undefined ? String(searchParamVal) : undefined,
      };
    }

    case "add_note": {
      const contentVal = getParamValue("content", "Text");
      const gameIdVal = getParamValue("gameId", "GameId") || getParamValue("gameId", "gameId");
      return {
        gameId: gameIdVal !== undefined ? String(gameIdVal) : (gameTarget ? gameTarget.name : ""),
        content: contentVal !== undefined ? String(contentVal) : "",
      };
    }

    case "library_question": {
      const questionVal = getParamValue("question", "Text");
      return { question: questionVal !== undefined ? String(questionVal) : "" };
    }

    case "recommend_games": {
      // A "like <game>" hint may arrive as a Game target rather than text.
      const queryVal = getParamValue("query", "Text");
      const hint = [queryVal, gameTarget?.name].filter(Boolean).join(" ");
      return { query: hint || undefined };
    }

    case "launch_game": {
      const gameIdVal = getParamValue("gameId", "GameId") || getParamValue("gameId", "gameId");
      return {
        gameId: gameIdVal !== undefined ? String(gameIdVal) : (gameTarget ? gameTarget.name : ""),
      };
    }

    case "create_collection": {
      const nameVal = getParamValue("name", "Name") || getParamValue("collectionName", "Collection");
      return {
        name: nameVal !== undefined ? String(nameVal) : (collectionTarget ? collectionTarget.name : ""),
      };
    }

    case "add_to_collection":
    case "remove_from_collection": {
      const gameIdVal = getParamValue("gameId", "GameId") || getParamValue("gameId", "gameId");
      const nameVal = getParamValue("collectionName", "CollectionName") || getParamValue("collectionName", "Collection") || getParamValue("name", "Name");

      return {
        collectionName: nameVal !== undefined ? String(nameVal) : (collectionTarget ? collectionTarget.name : ""),
        gameId: gameIdVal !== undefined ? String(gameIdVal) : (gameTarget ? gameTarget.name : ""),
      };
    }

    case "connect_epic": {
      const authCodeVal = getParamValue("authorizationCode", "Text") || getParamValue("authorizationCode", "String");
      return {
        authorizationCode: authCodeVal !== undefined ? String(authCodeVal) : "",
        localGames: getParamValue("localGames", "Object") || [],
      };
    }

    case "disconnect_epic": {
      return {};
    }

    case "sync_epic": {
      return {
        localGames: getParamValue("localGames", "Object") || [],
      };
    }

  }
  return undefined;
}

/** RoninArc's tools: what each needs, which capability reaches it, and how its input is built. */
export const gameTools: DomainTools = {
  metadata,
  // Capabilities whose tool is chosen per request inside chooseTool().
  // Keep in sync with the branches there; the startup check relies on it.
  multiToolCapabilities: {
  "review-game": ["create_review", "delete_review"],
  "collection": ["create_collection", "add_to_collection", "remove_from_collection"],
},
  capabilityTools: {
  "complete-game": "update_status",
  "set-status": "update_status",
  "library-question": "library_question",
  "launch-game": "launch_game",
  "collection": "create_collection",
  "connect-account": "connect_epic",
  "disconnect-account": "disconnect_epic",
  "sync-library": "sync_epic",
  "add-game": "add_game",
  "remove-game": "remove_game",
  "search-library": "search_library",
  "add-note": "add_note",
  "recommend-games": "recommend_games",
},
  chooseTool,
  buildInput,
  // "Text" is shared by multiple tools' free-text parameters -- which concrete key
  // it becomes depends on which tool the step is for. Tools not listed get reviewText.
  textParamKeyByTool: {
    search_library: "searchValue",
    add_note: "content",
    recommend_games: "query",
    library_question: "question",
  },
  defaultTextParamKey: "reviewText",
  noReferenceFallbackTools: ["delete_review", "remove_from_collection", "disconnect_epic", "remove_game"],
};
