import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import providerToolService from "../../services/ProviderToolService";

interface ConnectEpicInput {
  authorizationCode: string;
  localGames?: any[];
}

export class ConnectEpicTool extends BaseTool<
  ConnectEpicInput,
  Awaited<ReturnType<typeof providerToolService.connectEpic>>
> {
  readonly category = "provider";

  readonly name = "connect_epic";

  readonly description =
    "Connects the user's Epic Games account using an authorization code.";

  async execute(
    input: ConnectEpicInput,
    context: AIToolContext,
  ): Promise<
    AIToolResult<Awaited<ReturnType<typeof providerToolService.connectEpic>>>
  > {
    const result = await providerToolService.connectEpic(
      context.userId,
      input.authorizationCode,
      input.localGames,
    );

    if (!result) {
      return {
        success: false,
        error: "Failed to connect Epic Games account.",
      };
    }

    return {
      success: true,
      message: "Epic Games account connected successfully.",
      data: result,
    };
  }
}
