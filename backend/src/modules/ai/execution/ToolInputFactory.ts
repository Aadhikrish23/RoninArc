import { ExecutionStep } from "./ExecutionStep";
import aiTraceLogger from "../debug/AITraceLogger";

export class ToolInputFactory {
  /**
   * Builds the concrete tool input payload from abstract targets and parameters.
   */
  createInput(step: ExecutionStep): Record<string, unknown> {
    const targets = (step.input.targets as any[]) || [];
    const parameters = (step.input.parameters as any[]) || [];
    const capabilityId = step.input.capabilityId as string;

    const gameTarget = targets.find((t) => t.type === "Game");
    const collectionTarget = targets.find((t) => t.type === "Collection");

    const ratingParam = parameters.find((p) => p.type === "Rating");
    const statusParam = parameters.find((p) => p.type === "Status");
    const textParam = parameters.find((p) => p.type === "Text");

    try {
      switch (step.toolName) {
        case "update_status": {
          let progressStatus = "plan";
          if (capabilityId === "complete-game") {
            progressStatus = "completed";
          } else if (statusParam) {
            progressStatus = String(statusParam.value);
          }

          return {
            gameId: gameTarget ? gameTarget.name : "",
            progressStatus,
          };
        }

        case "create_review":
        case "update_review": {
          return {
            gameId: gameTarget ? gameTarget.name : "",
            rating: ratingParam ? Number(ratingParam.value) : 5,
            reviewText: textParam ? String(textParam.value) : "",
          };
        }

        case "launch_game": {
          return {
            gameId: gameTarget ? gameTarget.name : "",
          };
        }

        case "create_collection":
        case "add_to_collection":
        case "remove_from_collection": {
          const gameNames = targets
            .filter((t) => t.type === "Game")
            .map((t) => t.name);

          return {
            name: collectionTarget ? collectionTarget.name : "",
            gameIds: gameNames,
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
