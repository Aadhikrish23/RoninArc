import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import providerToolService from "../../services/ProviderToolService";

interface SyncEpicInput {
  localGames?: any[];
}

export class SyncEpicTool extends BaseTool<
  SyncEpicInput,
  Awaited<ReturnType<typeof providerToolService.syncEpic>>
> {
  readonly category = "provider";

  readonly name = "sync_epic";

  readonly description =
    "Syncs the user's Epic Games library and local installations.";

  async execute(
    input: SyncEpicInput,
    context: AIToolContext,
  ): Promise<
    AIToolResult<Awaited<ReturnType<typeof providerToolService.syncEpic>>>
  > {
    const result = await providerToolService.syncEpic(
      context.userId,
      input.localGames,
    );

    if (!result) {
      return {
        success: false,
        error: "Failed to sync Epic Games account.",
      };
    }

    return {
      success: true,
      message: "Epic Games account synced successfully.",
      data: result,
    };
  }
}
