import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import launcherToolService from "../../services/LauncherToolService";

interface LaunchGameInput {
  gameId: string;
}

export class LaunchGameTool extends BaseTool<
  LaunchGameInput,
  Awaited<ReturnType<typeof launcherToolService.launchGame>>
> {
  readonly category = "launcher";

  readonly name = "launch_game";

  readonly description =
    "Launches a game from the user's library and starts a play session.";

  async execute(
    input: LaunchGameInput,
    context: AIToolContext,
  ): Promise<
    AIToolResult<Awaited<ReturnType<typeof launcherToolService.launchGame>>>
  > {
    const session = await launcherToolService.launchGame(
      context.userId,
      input.gameId,
    );

    if (!session) {
      return {
        success: false,
        error: "Failed to launch game.",
      };
    }

    return {
      success: true,
      message: "Game launched successfully.",
      data: session,
    };
  }
}
