import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import collectionToolService from "../../services/CollectionToolService";
import Collection from "../../../collection/CollectionModel";

interface RemoveFromCollectionInput {
  collectionName: string;
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
    const collection = await Collection.findOne({
      userId: context.userId,
      name: input.collectionName.trim(),
    });

    if (!collection) {
      return this.failure(`Collection "${input.collectionName}" not found.`);
    }

    const resultCollection = await collectionToolService.removeGameFromCollection(
      context.userId,
      collection._id.toString(),
      input.gameId,
    );

    if (!resultCollection) {
      return this.failure("Failed to remove game from collection.");
    }

    return this.success(resultCollection, "Game removed from collection successfully.");
  }
}
