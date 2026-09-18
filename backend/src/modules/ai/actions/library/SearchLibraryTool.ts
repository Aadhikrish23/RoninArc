import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import libraryToolService from "../../services/LibraryToolService";

// Mirrors librarycontroller's allowedSearchParams -- searchParam becomes a raw
// Mongo query key, so it must stay restricted to a known-safe allowlist.
const ALLOWED_SEARCH_PARAMS = ["title", "tags", "progressStatus"];

interface SearchLibraryInput {
  searchValue: string;
  searchParam?: string;
}

export class SearchLibraryTool extends BaseTool<SearchLibraryInput, any> {
  readonly category = "library";

  readonly name = "search_library";

  readonly description = "Searches the user's library by title, tag, or status.";

  async execute(
    input: SearchLibraryInput,
    context: AIToolContext,
  ): Promise<AIToolResult<any>> {
    const searchValue = (input.searchValue || "").trim();
    if (!searchValue) {
      return this.failure("I need something to search for.");
    }

    // An explicit, valid field wins outright. Otherwise the request rarely says
    // whether "Hollow Knight" means a title or a tag, so search every allowed
    // field and merge the results rather than guessing one and coming up empty.
    const fieldsToSearch = ALLOWED_SEARCH_PARAMS.includes(input.searchParam || "")
      ? [input.searchParam as string]
      : ALLOWED_SEARCH_PARAMS;

    const byId = new Map<string, any>();
    for (const field of fieldsToSearch) {
      const found = await libraryToolService.searchLibrary(context.userId, field, searchValue);
      for (const game of found || []) {
        byId.set(String(game._id), game);
      }
    }
    const results = Array.from(byId.values());

    if (!results || results.length === 0) {
      return this.success([], `I didn't find any games matching "${searchValue}" in your library.`);
    }

    const titles = results.map((g: any) => g.title).join(", ");
    return this.success(results, `Found ${results.length} game(s): ${titles}.`);
  }
}
