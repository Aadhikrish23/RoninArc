import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import launcherToolService from "../../services/LauncherToolService";

interface LaunchGameInput {
  gameId: string;
}

interface LaunchGameOutput {
  gameId: string;
  title: string;
  /** True when the launch was handed to the desktop app; false on clients that can't launch. */
  launched: boolean;
}

/**
 * Asks the user's desktop app to launch a game. The server can't start a
 * process on the player's PC, so instead of pretending (and leaving an open
 * play session behind) it returns a `launch_game` client action; the app
 * then runs its normal launch flow, which starts and ends the play session.
 */
export class LaunchGameTool extends BaseTool<LaunchGameInput, LaunchGameOutput> {
  readonly category = "launcher";

  readonly name = "launch_game";

  readonly description =
    "Launches a game from the user's library through the RoninArc desktop app.";

  async execute(input: LaunchGameInput, context: AIToolContext): Promise<AIToolResult<LaunchGameOutput>> {
    const game = await launcherToolService.findGame(context.userId, input.gameId);

    if (!game) {
      return this.failure("Game not found.");
    }

    const result = { gameId: String(game._id), title: game.title };

    if (!context.client?.canLaunchGames) {
      return this.success({ ...result, launched: false }, "Launching only works in the desktop app.");
    }

    context.clientActions?.push({ type: "launch_game", ...result });
    return this.success({ ...result, launched: true }, "Launch handed to the desktop app.");
  }
}
