import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import rawgToolService from "../../services/RawgToolService";

interface SearchRawgInput {
  query: string;
  page?: number;
}

export class SearchRawgTool extends BaseTool<
  SearchRawgInput,
  Awaited<ReturnType<typeof rawgToolService.searchGames>>
> {
  readonly category = "rawg";

  readonly name = "search_rawg";

  readonly description = "Searches for games using the RAWG database.";

  async execute(
    input: SearchRawgInput,
    context: AIToolContext,
  ): Promise<
    AIToolResult<Awaited<ReturnType<typeof rawgToolService.searchGames>>>
  > {
    const results = await rawgToolService.searchGames(
      input.query,
      input.page || 1,
    );

    return this.success(results, `Found ${results.length} games.`);
  }
}
