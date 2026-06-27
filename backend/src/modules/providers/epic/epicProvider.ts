import { GameProvider } from "../shared/GameProvider";
import epicAuthService from "./epicAuthService";
import { exchangeAuthorizationCode } from "./epicOAuthService";
import epicLibraryService from "./epicLibraryService";
import syncService from "../syncService";
import User from "../../auth/models/User";

class EpicProvider implements GameProvider {
  async getStatus(userId: string) {
    return await epicAuthService.getStatus(userId);
  }

  async getLoginUrl() {
    return epicAuthService.getLoginUrl();
  }

  async connect(userId: string, body: any) {
    const { authorizationCode, localGames = [] } = body;
    if (!authorizationCode) {
      throw new Error("Authorization code required");
    }

    const tokenData = await exchangeAuthorizationCode(authorizationCode);

    await epicAuthService.connect(userId, {
      epicAccountId: tokenData.account_id,
      displayName: tokenData.displayName,
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      accessTokenExpiresAt: new Date(tokenData.expires_at),
    });

    const libraryResult = await epicLibraryService.syncLibrary(userId);
    const metadataResult = await epicLibraryService.syncMetadata(userId);
    await syncService.syncEpicGames(userId, localGames);

    await User.findByIdAndUpdate(userId, {
      $set: {
        "providers.epic.lastSyncAt": new Date(),
      },
    });

    return {
      connected: true,
      displayName: tokenData.displayName,
      totalGames: libraryResult.totalGames,
    };
  }

  async disconnect(userId: string) {
    await epicAuthService.disconnect(userId);
    await syncService.disconnectProviderGames(userId, "epic");
  }

  async resync(userId: string, body: any) {
    const { localGames = [] } = body;
    const libraryResult = await epicLibraryService.syncLibrary(userId);
    const metadataResult = await epicLibraryService.syncMetadata(userId);
    await syncService.syncEpicGames(userId, localGames);

    await User.findByIdAndUpdate(userId, {
      $set: {
        "providers.epic.lastSyncAt": new Date(),
      },
    });

    return {
      imported: libraryResult.imported,
      totalGames: libraryResult.totalGames,
    };
  }

  async refreshInstallations(userId: string, localGames: any[]) {
    const formattedGames = localGames.map((l: any) => ({
      providerGameId: l.catalogItemId,
      title: l.name,
      installed: true,
      installPath: l.installPath,
      manifestId: l.epicId,
      executable: l.executable,
      launcher: "epic",
    }));

    return await syncService.syncInstallationsOnly(userId, "epic", formattedGames);
  }
}

export default new EpicProvider();

