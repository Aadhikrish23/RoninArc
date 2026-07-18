import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import collectionToolService from "../../services/CollectionToolService";

interface CreateCollectionInput {
  name: string;
  description?: string;
}

export class CreateCollectionTool extends BaseTool<
  CreateCollectionInput,
  Awaited<ReturnType<typeof collectionToolService.createCollection>>
> {
  readonly category = "collection";

  readonly name = "create_collection";

  readonly description =
    "Creates a new collection with a name and optional description.";

  async execute(
    input: CreateCollectionInput,
    context: AIToolContext,
  ): Promise<
    AIToolResult<
      Awaited<ReturnType<typeof collectionToolService.createCollection>>
    >
  > {
    const collection = await collectionToolService.createCollection(
      context.userId,
      input.name,
      input.description,
    );

    if (!collection) {
      return this.failure("Failed to create collection.");
    }

    return this.success(collection, `Collection "${input.name}" created successfully.`);
  }
}
