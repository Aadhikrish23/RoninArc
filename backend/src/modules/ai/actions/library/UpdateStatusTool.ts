import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import libraryToolService from "../../services/LibraryToolService";

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
  Awaited<ReturnType<typeof libraryToolService.updateStatus>>
> {
  readonly category = "library";

  readonly name = "update_status";

  readonly description =
    "Updates the progress status of a game in the user's library.";

  async execute(
    input: UpdateStatusInput,
    context: AIToolContext,
  ): Promise<AIToolResult<Awaited<ReturnType<typeof libraryToolService.updateStatus>>>> {
    const game = await libraryToolService.updateStatus(
      context.userId,
      input.gameId,
      input.progressStatus,
    );

    if (!game) {
      return {
        success: false,
        error: "Game not found.",
      };
    }

    return {
      success: true,
      message: `Updated status to "${input.progressStatus}".`,
      data: game,
    };
  }
}
