import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import libraryToolService from "../../services/LibraryToolService";
import rawgToolService from "../../services/RawgToolService";

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

    // RAWG orders results by popularity ("added" count), not title relevance --
    // e.g. searching "Hollow Knight" ranks the more-popular "Batman: Arkham
    // Knight" first purely because both match "Knight". Prefer an exact title
    // match over RAWG's own top result, same principle as the library's own
    // exact-match-before-fuzzy entity resolution.
    const normalizedQuery = gameName.toLowerCase();
    const exactMatch = results.find((g: any) => (g.name || "").trim().toLowerCase() === normalizedQuery);
    const match = exactMatch || results[0];

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
