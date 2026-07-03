import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import providerToolService from "../../services/ProviderToolService";

export class DisconnectEpicTool extends BaseTool<
  void,
  Awaited<ReturnType<typeof providerToolService.disconnectEpic>>
> {
  readonly category = "provider";

  readonly name = "disconnect_epic";

  readonly description = "Disconnects the user's Epic Games account.";

  async execute(
    input: void,
    context: AIToolContext,
  ): Promise<
    AIToolResult<Awaited<ReturnType<typeof providerToolService.disconnectEpic>>>
  > {
    await providerToolService.disconnectEpic(context.userId);

    return {
      success: true,
      message: "Epic Games account disconnected successfully.",
    };
  }
}
