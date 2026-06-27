import { GameProvider } from "../shared/GameProvider";
import syncService from "../syncService";
import User from "../../auth/models/User";
import gameLibrarymodel from "../../library/LibraryGame";

class SteamProvider implements GameProvider {
  async getStatus(userId: string) {
    const user = await User.findById(userId);
    const count = user?.providers?.steam
      ? await gameLibrarymodel.countDocuments({ userId, "providers.steam": { $exists: true } })
      : 0;

    return {
      connected: !!user?.providers?.steam,
      displayName: user?.providers?.steam?.displayName || null,
      connectedAt: user?.providers?.steam?.connectedAt || null,
      importedGames: count,
      lastSync: user?.providers?.steam?.lastSyncAt || null,
    };
  }

  async connect(userId: string, body: any) {
    const { localGames = [] } = body;

    await User.findByIdAndUpdate(userId, {
      $set: {
        "providers.steam": {
          displayName: "Local Steam",
          connectedAt: new Date(),
          lastSyncAt: new Date(),
        },
      },
    });

    await syncService.syncSteamGames(userId, localGames);

    const count = await gameLibrarymodel.countDocuments({ userId, "providers.steam": { $exists: true } });

    return {
      connected: true,
      displayName: "Local Steam",
      totalGames: count,
    };
  }

  async disconnect(userId: string) {
    await User.findByIdAndUpdate(userId, {
      $unset: {
        "providers.steam": "",
      },
    });

    await syncService.disconnectProviderGames(userId, "steam");
  }

  async resync(userId: string, body: any) {
    const { localGames = [] } = body;

    await syncService.syncSteamGames(userId, localGames);

    await User.findByIdAndUpdate(userId, {
      $set: {
        "providers.steam.lastSyncAt": new Date(),
      },
    });

    const count = await gameLibrarymodel.countDocuments({ userId, "providers.steam": { $exists: true } });

    return {
      imported: localGames.length,
      totalGames: count,
    };
  }

  async refreshInstallations(userId: string, localGames: any[]) {
    const formattedGames = localGames.map((l: any) => ({
      providerGameId: l.appId,
      title: l.name,
      imageURL: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${l.appId}/library_600x900_2x.jpg`,
      installed: true,
      installPath: l.installPath,
      manifestId: l.appId,
      executable: l.executable || "",
      launcher: "steam",
    }));

    return await syncService.syncInstallationsOnly(userId, "steam", formattedGames);
  }
}

export default new SteamProvider();

