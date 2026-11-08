import igdbService from "../../../../igdb/igdbService";

export class GameDbToolService {
  /**
   * Searches the game database for games matching the query.
   */
  async searchGames(
    query: string,
    page: number = 1,
    precise = true,
  ): Promise<Awaited<ReturnType<typeof igdbService.searchGames>>> {
    return igdbService.searchGames(query, page, precise);
  }
}

export default new GameDbToolService();
