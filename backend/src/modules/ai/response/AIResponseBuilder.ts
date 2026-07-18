import { ExecutionResult } from "../execution/ExecutionResult";

export class AIResponseBuilder {
  /**
   * Translates step execution result properties into user-friendly statements.
   */
  buildResponse(executionResult: ExecutionResult): string {
    if (executionResult.status === "FAILED") {
      const failedStep = executionResult.steps.find((s) => s.status === "FAILED");
      if (failedStep && failedStep.error) {
        return `I encountered an issue executing your request: ${failedStep.error}`;
      }
      if (executionResult.errors && executionResult.errors.length > 0) {
        const cleanErr = executionResult.errors[0].replace(/^Validation failed:\s*/i, "");
        return `I encountered an issue executing your request: ${cleanErr}`;
      }
      return `I encountered an issue executing your request: ${executionResult.summary || "Unknown error."}`;
    }

    if (executionResult.steps.length === 0) {
      return "I didn't need to perform any steps.";
    }

    const sentences: string[] = [];

    const getGameName = (step: any): string => {
      const targets = (step.input?.targets as any[]) || [];
      const gameTarget = targets.find((t) => t.type === "Game" || t.type?.toLowerCase() === "game");
      if (gameTarget && gameTarget.name) {
        const name = String(gameTarget.name);
        if (!/^[0-9a-fA-F]{24}$/.test(name)) {
          return name;
        }
      }
      const params = (step.input?.parameters as Record<string, unknown>) || {};
      const gameIdVal = String(params.gameId || params.gameName || "");
      if (gameIdVal && !/^[0-9a-fA-F]{24}$/.test(gameIdVal)) {
        return gameIdVal;
      }
      return "the game";
    };

    for (const step of executionResult.steps) {
      if (step.status !== "SUCCESS") continue;

      const params = (step.input.parameters as Record<string, unknown>) || {};
      const gameName = getGameName(step);

      if (step.tool === "LaunchGameTool" || step.tool === "launch_game") {
        sentences.push(`I've launched ${gameName} and started your play session.`);
      } else if (step.tool === "InstallGameTool" || step.tool === "install_game") {
        sentences.push(`I've started installing ${gameName}.`);
      } else if (step.tool === "CreateCollectionTool" || step.tool === "create_collection") {
        sentences.push(`I've created the collection "${params.name}".`);
      } else if (step.tool === "AddToCollectionTool" || step.tool === "add_to_collection") {
        sentences.push(`I've added ${gameName} to your collection "${params.collectionName}".`);
      } else if (step.tool === "RemoveFromCollectionTool" || step.tool === "remove_from_collection") {
        sentences.push(`I've removed ${gameName} from your collection "${params.collectionName}".`);
      } else if (step.tool === "UpdateStatusTool" || step.tool === "update_status") {
        if (step.output && (step.output as any).metadata?.alreadyInStatus && step.output.message) {
          sentences.push(step.output.message as string);
        } else {
          sentences.push(`I've marked ${gameName} as ${params.progressStatus || "completed"}.`);
        }
      } else if (step.tool === "CreateReviewTool" || step.tool === "create_review") {
        sentences.push(`I've posted your ${params.rating}-star review for ${gameName}.`);
      } else if (step.tool === "UpdateReviewTool" || step.tool === "update_review") {
        sentences.push(`I've updated your review for ${gameName} to ${params.rating} stars.`);
      } else if (step.tool === "DeleteReviewTool" || step.tool === "delete_review") {
        sentences.push(`I've removed your review for ${gameName}.`);
      } else if (step.tool === "ConnectEpicTool" || step.tool === "connect_epic") {
        if (step.output && (step.output as any).data?.alreadyConnected) {
          sentences.push("Your Epic Games account is already connected.");
        } else {
          sentences.push("I've connected your Epic Games account.");
        }
      } else if (step.tool === "DisconnectEpicTool" || step.tool === "disconnect_epic") {
        if (step.output && (step.output as any).data?.alreadyDisconnected) {
          sentences.push("Your Epic Games account is already disconnected.");
        } else {
          sentences.push("I've disconnected your Epic Games account.");
        }
      } else if (step.tool === "SyncEpicTool" || step.tool === "sync_epic") {
        sentences.push("I've synced your Epic Games library.");
      } else {
        sentences.push(`Completed step for ${step.tool}.`);
      }
    }

    if (sentences.length > 0) {
      return sentences.join(" ");
    }

    return "Execution completed successfully.";
  }
}

export default new AIResponseBuilder();
