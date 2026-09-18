import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import libraryToolService from "../../services/LibraryToolService";

interface RemoveGameInput {
  gameId: string;
}

export class RemoveGameTool extends BaseTool<RemoveGameInput, any> {
  readonly category = "library";

  readonly name = "remove_game";

  readonly description = "Removes a game from the user's library.";

  async execute(
    input: RemoveGameInput,
    context: AIToolContext,
  ): Promise<AIToolResult<any>> {
    const game = await libraryToolService.removeGame(
      context.userId,
      input.gameId,
    );

    if (!game) {
      return this.failure("Game not found in your library.");
    }

    return this.success(game, `I've removed "${game.title}" from your library.`);
  }
}
