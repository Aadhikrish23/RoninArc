import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import providerToolService from "../../services/ProviderToolService";
import epicAuthService from "../../../providers/epic/epicAuthService";

interface ConnectEpicInput {
  authorizationCode: string;
  localGames?: any[];
}

export class ConnectEpicTool extends BaseTool<
  ConnectEpicInput,
  any
> {
  readonly category = "provider";

  readonly name = "connect_epic";

  readonly description =
    "Connects the user's Epic Games account using an authorization code.";

  async execute(
    input: ConnectEpicInput,
    context: AIToolContext,
  ): Promise<
    AIToolResult<any>
  > {
    const status = await epicAuthService.getStatus(context.userId);
    if (status.connected) {
      return this.success(
        { connected: true, displayName: status.displayName, alreadyConnected: true },
        "Epic Games account is already connected."
      );
    }

    const result = await providerToolService.connectEpic(
      context.userId,
      input.authorizationCode,
      input.localGames,
    );

    if (!result) {
      return this.failure("Failed to connect Epic Games account.");
    }

    return this.success(result, "Epic Games account connected successfully.");
  }
}
