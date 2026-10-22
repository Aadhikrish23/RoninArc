import { ExecutionResult } from "../../../execution/ExecutionResult";

/** "I've added A to your collection "X". I've added B to your collection "X"." -> "I've added A and B to your collection "X"." */
function mergeCollectionAdds(sentences: string[]): string[] {
  const out: string[] = [];
  const pattern = /^I've (added|removed) (.+) (to|from) your collection "(.+)"\.$/;
  for (const sentence of sentences) {
    const m = sentence.match(pattern);
    const prev = out.length ? out[out.length - 1].match(pattern) : null;
    if (m && prev && prev[1] === m[1] && prev[4] === m[4]) {
      const names = prev[2].split(/, | and /).concat(m[2]);
      const list = names.length === 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
      out[out.length - 1] = `I've ${m[1]} ${list} ${m[3]} your collection "${m[4]}".`;
    } else {
      out.push(sentence);
    }
  }
  return out;
}

export class AIResponseBuilder {
  /**
   * Translates step execution result properties into user-friendly statements.
   */
  buildResponse(executionResult: ExecutionResult): string {
    if (executionResult.status === "FAILED") {
      const failedStep = executionResult.steps.find((s) => s.status === "FAILED");
      if (failedStep && failedStep.error) {
        return failedStep.error;
      }
      if (executionResult.errors && executionResult.errors.length > 0) {
        const cleanErr = executionResult.errors[0].replace(/^Validation failed:\s*/i, "");
        return cleanErr;
      }
      return executionResult.summary || "Something went wrong on my side. Please try that again.";
    }

    if (executionResult.steps.length === 0) {
      return "I didn't need to perform any steps.";
    }

    const sentences: string[] = [];

    const getGameName = (step: any): string => {
      // The tool's own result names the game exactly ("Celeste", not "celeste" or an id).
      const outputTitle = step.output?.data?.title ?? step.output?.metadata?.gameTitle;
      if (typeof outputTitle === "string" && outputTitle) return outputTitle;
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
      if (step.status !== "SUCCESS") {
        sentences.push(step.error ? step.error : "One of those steps didn't work.");
        continue;
      }

      const params = (step.input.parameters as Record<string, unknown>) || {};
      const gameName = getGameName(step);

      if (step.tool === "LaunchGameTool" || step.tool === "launch_game") {
        // The server never starts the game itself: the desktop app does it (clientActions).
        if ((step.output?.data as { launched?: boolean } | undefined)?.launched) {
          sentences.push(`Launching ${gameName} on your PC.`);
        } else {
          sentences.push(`You're using RoninArc in the browser, and launching games needs the RoninArc desktop app, so I can't start ${gameName} from here.`);
        }
      } else if (step.tool === "InstallGameTool" || step.tool === "install_game") {
        sentences.push(`I've started installing ${gameName}.`);
      } else if (step.tool === "CreateCollectionTool" || step.tool === "create_collection") {
        sentences.push(`I've created the collection "${params.name}".`);
      } else if (step.tool === "AddToCollectionTool" || step.tool === "add_to_collection") {
        sentences.push(
          (step.output as any)?.metadata?.alreadyInCollection
            ? `${gameName} was already in your collection "${params.collectionName}".`
            : `I've added ${gameName} to your collection "${params.collectionName}".`,
        );
      } else if (step.tool === "RemoveFromCollectionTool" || step.tool === "remove_from_collection") {
        sentences.push(
          (step.output as any)?.metadata?.notInCollection
            ? `${gameName} wasn't in your collection "${params.collectionName}", so nothing changed.`
            : `I've removed ${gameName} from your collection "${params.collectionName}".`,
        );
      } else if (step.tool === "UpdateStatusTool" || step.tool === "update_status") {
        if (step.output && (step.output as any).metadata?.alreadyInStatus && step.output.message) {
          sentences.push(step.output.message as string);
        } else {
          const label: Record<string, string> = { plan: "Plan to Play", playing: "Playing", paused: "Paused", completed: "Completed", dropped: "Dropped" };
          // The updated game says what the status really is now.
          const status = String((step.output as any)?.data?.progressStatus || params.progressStatus || params.status || "completed");
          sentences.push(
            status === "none"
              ? `I've cleared the status on ${gameName}.`
              : status === "completed"
                ? `I've marked ${gameName} as Completed. Congrats on finishing it!`
                : `I've marked ${gameName} as ${label[status] ?? status}.`,
          );
        }
      } else if (step.tool === "CreateReviewTool" || step.tool === "create_review") {
        const withText = typeof params.reviewText === "string" && params.reviewText.trim() ? " with your comment" : "";
        sentences.push(`I've rated ${gameName} ${params.rating}/10${withText}.`);
      } else if (step.tool === "UpdateReviewTool" || step.tool === "update_review") {
        sentences.push(`I've updated your rating for ${gameName} to ${params.rating}/10.`);
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
      } else if (step.output && (step.output as any).message) {
        // Every tool already builds a specific message via this.success(data,
        // message) -- use it instead of a generic placeholder for any tool
        // (present or future) that doesn't have its own template above.
        sentences.push((step.output as any).message as string);
      } else {
        sentences.push(`Completed step for ${step.tool}.`);
      }
    }

    if (sentences.length > 0) {
      return mergeCollectionAdds(sentences).join(" ");
    }

    return "Execution completed successfully.";
  }
}

export default new AIResponseBuilder();
