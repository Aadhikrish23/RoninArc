import { BaseTool } from "../../../../sdk/BaseTool";
import { AIToolContext } from "../../../../sdk/AIToolContext";
import { AIToolResult } from "../../../../sdk/AIToolResult";
import providerToolService from "../../services/ProviderToolService";
import epicAuthService from "../../../../../providers/epic/epicAuthService";

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
    // "sync my library" with nothing connected: say so, instead of "Epic account is not connected. Please reconnect."
    const status = await epicAuthService.getStatus(context.userId).catch(() => ({ connected: false }));
    if (!status.connected) {
      return this.failure(
        "There's no Epic Games account connected, so there's nothing to sync. To import your games, connect Steam or Epic in Settings → Providers in RoninArc on your PC.",
      );
    }

    const result = await providerToolService.syncEpic(
      context.userId,
      input.localGames,
    );

    if (!result) {
      return this.failure("Failed to sync Epic Games account.");
    }

    return this.success(result, "Epic Games account synced successfully.");
  }
}
