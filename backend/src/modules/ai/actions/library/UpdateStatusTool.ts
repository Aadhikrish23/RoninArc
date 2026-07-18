import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import libraryToolService from "../../services/LibraryToolService";
import gameLibrarymodel from "../../../library/LibraryGame";

interface UpdateStatusInput {
  gameId: string;
  progressStatus:
    | "none"
    | "plan"
    | "playing"
    | "paused"
    | "completed"
    | "dropped";
}

export class UpdateStatusTool extends BaseTool<
  UpdateStatusInput,
  any
> {
  readonly category = "library";

  readonly name = "update_status";

  readonly description =
    "Updates the progress status of a game in the user's library.";

  async execute(
    input: UpdateStatusInput,
    context: AIToolContext,
  ): Promise<AIToolResult<any>> {
    const gameObj = await gameLibrarymodel.findOne({
      _id: input.gameId,
      userId: context.userId,
    });

    if (!gameObj) {
      return this.failure("Game not found in library.");
    }

    if (gameObj.progressStatus === input.progressStatus) {
      const displayStatus = input.progressStatus === "completed" ? "completed" : input.progressStatus;
      const message = input.progressStatus === "completed"
        ? `${gameObj.title} is already completed.`
        : `${gameObj.title} is already marked as ${displayStatus}.`;
      return this.success(
        gameObj.toObject(),
        message,
        { alreadyInStatus: true }
      );
    }

    const game = await libraryToolService.updateStatus(
      context.userId,
      input.gameId,
      input.progressStatus,
    );

    if (!game) {
      return this.failure("Game not found.");
    }

    return this.success(game, `Updated status to "${input.progressStatus}".`);
  }
}
