import { BaseTool } from "../../../../sdk/BaseTool";
import { AIToolContext } from "../../../../sdk/AIToolContext";
import { AIToolResult } from "../../../../sdk/AIToolResult";
import collectionToolService from "../../services/CollectionToolService";
import GameLibrary from "../../../../../library/LibraryGame";
import Collection from "../../../../../collection/CollectionModel";

interface RemoveFromCollectionInput {
  collectionName: string;
  gameId: string;
}

/** The game's real title, for the reply ("Hades II", not the "hades 2" the user typed). */
async function titleOf(userId: string, gameId: string): Promise<string | undefined> {
  const game = await GameLibrary.findOne({ _id: gameId, userId }).select("title").lean().catch(() => null);
  return (game as { title?: string } | null)?.title;
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

    // "wasn't in there" is reported as such, not as "I've removed ...".
    const wasIn = collection.gameIds.some((id: any) => String(id) === String(input.gameId));

    const resultCollection = await collectionToolService.removeGameFromCollection(
      context.userId,
      collection._id.toString(),
      input.gameId,
    );

    if (!resultCollection) {
      return this.failure("Failed to remove game from collection.");
    }

    return this.success(resultCollection, wasIn ? "Game removed from collection successfully." : "Game wasn't in the collection.", {
      notInCollection: !wasIn,
      gameTitle: await titleOf(context.userId, input.gameId),
    });
  }
}
