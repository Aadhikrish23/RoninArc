import epicProvider from "../../providers/epic/epicProvider";

export class ProviderToolService {
  /**
   * Connects Epic account using authorization code and optionally syncs local installations.
   */
  async connectEpic(
    userId: string,
    authorizationCode: string,
    localGames: any[] = [],
  ): Promise<Awaited<ReturnType<typeof epicProvider.connect>>> {
    return epicProvider.connect(userId, { authorizationCode, localGames });
  }

  /**
   * Disconnects Epic account.
   */
  async disconnectEpic(
    userId: string,
  ): Promise<Awaited<ReturnType<typeof epicProvider.disconnect>>> {
    return epicProvider.disconnect(userId);
  }

  /**
   * Syncs Epic account library and local installations.
   */
  async syncEpic(
    userId: string,
    localGames: any[] = [],
  ): Promise<Awaited<ReturnType<typeof epicProvider.resync>>> {
    return epicProvider.resync(userId, { localGames });
  }
}

export default new ProviderToolService();
