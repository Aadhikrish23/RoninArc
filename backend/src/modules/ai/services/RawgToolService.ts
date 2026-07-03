import rawgService from "../../rawg/rawgService";

export class RawgToolService {
  /**
   * Searches RAWG for games matching the query.
   */
  async searchGames(
    query: string,
    page: number = 1,
  ): Promise<Awaited<ReturnType<typeof rawgService.searchGames>>> {
    return rawgService.searchGames(query, page);
  }
}

export default new RawgToolService();
