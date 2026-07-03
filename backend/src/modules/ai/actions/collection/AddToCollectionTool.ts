import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import collectionToolService from "../../services/CollectionToolService";

interface AddToCollectionInput {
  collectionId: string;
  gameId: string;
}

export class AddToCollectionTool extends BaseTool<
  AddToCollectionInput,
  Awaited<ReturnType<typeof collectionToolService.addGameToCollection>>
> {
  readonly category = "collection";

  readonly name = "add_to_collection";

  readonly description = "Adds a game to a collection.";

  async execute(
    input: AddToCollectionInput,
    context: AIToolContext,
  ): Promise<
    AIToolResult<
      Awaited<ReturnType<typeof collectionToolService.addGameToCollection>>
    >
  > {
    const collection = await collectionToolService.addGameToCollection(
      context.userId,
      input.collectionId,
      input.gameId,
    );

    if (!collection) {
      return {
        success: false,
        error: "Failed to add game to collection.",
      };
    }

    return {
      success: true,
      message: "Game added to collection successfully.",
      data: collection,
    };
  }
}
