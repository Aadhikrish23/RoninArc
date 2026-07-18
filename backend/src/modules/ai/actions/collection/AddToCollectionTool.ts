import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import collectionToolService from "../../services/CollectionToolService";
import Collection from "../../../collection/CollectionModel";
import collectionService from "../../../collection/collectionService";

interface AddToCollectionInput {
  collectionName: string;
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
    let collection = await Collection.findOne({
      userId: context.userId,
      name: input.collectionName.trim(),
    });

    if (!collection) {
      collection = await collectionService.createCollection(
        context.userId,
        input.collectionName,
      );
    }

    const resultCollection = await collectionToolService.addGameToCollection(
      context.userId,
      collection._id.toString(),
      input.gameId,
    );

    if (!resultCollection) {
      return this.failure("Failed to add game to collection.");
    }

    return this.success(resultCollection, "Game added to collection successfully.");
  }
}
