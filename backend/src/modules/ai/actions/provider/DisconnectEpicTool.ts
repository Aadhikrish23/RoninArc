import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import providerToolService from "../../services/ProviderToolService";
import epicAuthService from "../../../providers/epic/epicAuthService";

export class DisconnectEpicTool extends BaseTool<
  void,
  any
> {
  readonly category = "provider";

  readonly name = "disconnect_epic";

  readonly description = "Disconnects the user's Epic Games account.";

  async execute(
    input: void,
    context: AIToolContext,
  ): Promise<
    AIToolResult<any>
  > {
    const status = await epicAuthService.getStatus(context.userId);
    if (!status.connected) {
      return this.success(
        { connected: false, alreadyDisconnected: true },
        "Epic Games account is already disconnected."
      );
    }

    await providerToolService.disconnectEpic(context.userId);

    return this.success(undefined, "Epic Games account disconnected successfully.");
  }
}
