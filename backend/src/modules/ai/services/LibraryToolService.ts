import libraryServices from "../../library/libraryServices";

export class LibraryToolService {
  /**
   * Updates only the progress status of a library game.
   * AI tools should use this method instead of calling
   * libraryServices.updateGame() directly.
   */
  async updateStatus(
    userId: string,
    gameId: string,
    progressStatus: string,
  ): Promise<Awaited<ReturnType<typeof libraryServices.updateGame>>> {
    return libraryServices.updateGame(userId, gameId, {
      progressStatus,
    });
  }

  /**
   * Adds a game to the user's library.
   */
  async addGame(
    userId: string,
    payload: Parameters<typeof libraryServices.addGameToLibrary>[1],
  ): Promise<Awaited<ReturnType<typeof libraryServices.addGameToLibrary>>> {
    return libraryServices.addGameToLibrary(userId, payload);
  }

  /**
   * Removes a game from the user's library.
   */
  async removeGame(
    userId: string,
    gameId: string,
  ): Promise<Awaited<ReturnType<typeof libraryServices.deleteGame>>> {
    return libraryServices.deleteGame(userId, gameId);
  }

  /**
   * Searches the user's library.
   */
  async searchLibrary(
    userId: string,
    searchParam: string,
    searchValue: string,
  ): Promise<Awaited<ReturnType<typeof libraryServices.getGameFilter>>> {
    return libraryServices.getGameFilter(
      userId,
      searchParam,
      searchValue,
    );
  }
}

export default new LibraryToolService();