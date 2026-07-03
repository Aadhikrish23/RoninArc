import playSessionService from "../../playSession/playSessionService";

export class LauncherToolService {
  /**
   * Launches a game by starting a play session and creating a launch activity.
   */
  async launchGame(
    userId: string,
    gameId: string,
  ): Promise<Awaited<ReturnType<typeof playSessionService.launchGame>>> {
    return playSessionService.launchGame(userId, gameId);
  }
}

export default new LauncherToolService();
