import libraryServices from "../../../../library/libraryServices";

export class LauncherToolService {
  /**
   * The user's own library game, or null. Launching itself happens in the
   * desktop app, which also starts the play session and logs the launch.
   */
  async findGame(userId: string, gameId: string) {
    const games = await libraryServices.getGameFilter(userId, "_id", gameId);
    return games?.[0] ?? null;
  }
}

export default new LauncherToolService();
