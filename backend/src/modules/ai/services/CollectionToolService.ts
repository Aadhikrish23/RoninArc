import collectionService from "../../collection/collectionService";

export class CollectionToolService {
  /**
   * Creates a new collection.
   */
  async createCollection(
    userId: string,
    name: string,
    description?: string,
  ): Promise<Awaited<ReturnType<typeof collectionService.createCollection>>> {
    return collectionService.createCollection(userId, name, description);
  }

  /**
   * Adds a game to a collection.
   */
  async addGameToCollection(
    userId: string,
    collectionId: string,
    gameId: string,
  ): Promise<Awaited<ReturnType<typeof collectionService.addGameToCollection>>> {
    return collectionService.addGameToCollection(userId, collectionId, gameId);
  }

  /**
   * Removes a game from a collection.
   */
  async removeGameFromCollection(
    userId: string,
    collectionId: string,
    gameId: string,
  ): Promise<Awaited<ReturnType<typeof collectionService.removeGameFromCollection>>> {
    return collectionService.removeGameFromCollection(userId, collectionId, gameId);
  }
}

export default new CollectionToolService();
