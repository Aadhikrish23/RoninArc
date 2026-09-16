import { ExecutionStep } from "./ExecutionStep";
import aiTraceLogger from "../debug/AITraceLogger";

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
              progressStatus = String(statusVal);
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
            rating: ratingVal !== undefined ? Number(ratingVal) : 5,
            reviewText: textVal !== undefined ? String(textVal) : "",
          };
        }

        case "delete_review": {
          const gameIdVal = getParamValue("gameId", "GameId") || getParamValue("gameId", "gameId");
          return {
            gameId: gameIdVal !== undefined ? String(gameIdVal) : (gameTarget ? gameTarget.name : ""),
          };
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
