import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import collectionToolService from "../../services/CollectionToolService";

interface RemoveFromCollectionInput {
  collectionId: string;
  gameId: string;
}

export class RemoveFromCollectionTool extends BaseTool<
  RemoveFromCollectionInput,
  Awaited<ReturnType<typeof collectionToolService.removeGameFromCollection>>
> {
  readonly category = "collection";

  readonly name = "remove_from_collection";

  readonly description = "Removes a game from a collection.";

  async execute(
    input: RemoveFromCollectionInput,
    context: AIToolContext,
  ): Promise<
    AIToolResult<
      Awaited<ReturnType<typeof collectionToolService.removeGameFromCollection>>
    >
  > {
    const collection = await collectionToolService.removeGameFromCollection(
      context.userId,
      input.collectionId,
      input.gameId,
    );

    if (!collection) {
      return {
        success: false,
        error: "Failed to remove game from collection.",
      };
    }

    return {
      success: true,
      message: "Game removed from collection successfully.",
      data: collection,
    };
  }
}
