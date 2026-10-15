import { ExecutionStep } from "./ExecutionStep";
import aiTraceLogger from "../debug/AITraceLogger";

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

export class ToolInputFactory {
  /**
   * Builds the concrete tool input payload from abstract targets and parameters.
   */
  createInput(step: ExecutionStep): Record<string, unknown> {
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

    try {
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

        default:
          return {
            targets,
            parameters,
          };
      }
    } catch (error: any) {
      const trace = aiTraceLogger.current();
      if (trace) {
        trace.log("ToolInputFactory", "Mapping Exception details", {
          stepId: step.id,
          toolName: step.toolName,
          capabilityId,
          stepPayload: step.input,
          error: error.message || String(error),
        });
      }
      throw error;
    }
  }
}

export default new ToolInputFactory();
