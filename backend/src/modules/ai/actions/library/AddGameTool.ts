import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import libraryToolService from "../../services/LibraryToolService";
import rawgToolService from "../../services/RawgToolService";
import { MIN_CONFIDENT_MATCH, rankByTitle } from "../../../rawg/titleMatch";

interface AddGameInput {
  gameName: string;
}

export class AddGameTool extends BaseTool<AddGameInput, any> {
  readonly category = "library";

  readonly name = "add_game";

  readonly description =
    "Searches RAWG for a game by name and adds the best match to the user's library.";

  async execute(
    input: AddGameInput,
    context: AIToolContext,
  ): Promise<AIToolResult<any>> {
    const gameName = (input.gameName || "").trim();
    if (!gameName) {
      return this.failure("I need a game name to add.");
    }

    const results = await rawgToolService.searchGames(gameName, 1);
    if (!results || results.length === 0) {
      return this.failure(`I couldn't find "${gameName}" on RAWG.`);
    }

    // Never just take RAWG's first result: pick the title that actually matches
    // what was asked for (including abbreviations like "rdr 2" or "gta 5"), and
    // if nothing does, say so instead of adding some other game.
    const ranked = rankByTitle(gameName, results as typeof results[number][]);
    if (ranked[0].score < MIN_CONFIDENT_MATCH) {
      const closest = ranked.slice(0, 3).map((r) => `"${r.item.name}"`).join(", ");
      return this.failure(`I couldn't find a game called "${gameName}". The closest matches were ${closest}. Try the full title.`);
    }
    const match = ranked[0].item;

    try {
      const game = await libraryToolService.addGame(context.userId, {
        rawgId: match.id,
        title: match.name,
        imageURL: match.imageURL || undefined,
        tags: match.genres || [],
        progressStatus: "plan",
      });

      return this.success(game, `I've added "${match.name}" to your library.`);
    } catch (error: any) {
      if (error?.statusCode === 400 || /already exists/i.test(error?.message || "")) {
        return this.failure(`"${match.name}" is already in your library.`);
      }
      throw error;
    }
  }
}
