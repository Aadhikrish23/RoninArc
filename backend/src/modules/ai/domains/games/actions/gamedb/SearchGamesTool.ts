import { BaseTool } from "../../../../sdk/BaseTool";
import { AIToolContext } from "../../../../sdk/AIToolContext";
import { AIToolResult } from "../../../../sdk/AIToolResult";
import gameDbToolService from "../../services/GameDbToolService";

interface SearchGamesInput {
  query: string;
  page?: number;
}

export class SearchGamesTool extends BaseTool<
  SearchGamesInput,
  Awaited<ReturnType<typeof gameDbToolService.searchGames>>
> {
  readonly category = "gamedb";

  readonly name = "search_games";

  readonly description = "Searches for games using the game database.";

  async execute(
    input: SearchGamesInput,
    context: AIToolContext,
  ): Promise<
    AIToolResult<Awaited<ReturnType<typeof gameDbToolService.searchGames>>>
  > {
    const results = await gameDbToolService.searchGames(
      input.query,
      input.page || 1,
    );

    return this.success(results, `Found ${results.length} games.`);
  }
}
