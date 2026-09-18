import { GameProvider } from "../shared/GameProvider";
import syncService from "../syncService";
import User from "../../auth/models/User";
import gameLibrarymodel from "../../library/LibraryGame";
import steamOpenIdService from "./steamOpenIdService";
import steamWebApiService from "./steamWebApiService";
import AppError from "../../../shared/errors/AppError";

const STEAM_RETURN_URL =
  process.env.STEAM_RETURN_URL ||
  `http://localhost:${process.env.PORT || 5000}/provider/steam/oauth/return`;

function formatLocalGames(localGames: any[]) {
  return localGames.map((l: any) => ({
    providerGameId: String(l.appId),
    title: l.name,
    imageURL: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${l.appId}/library_600x900_2x.jpg`,
    installed: true,
    installPath: l.installPath,
    manifestId: l.appId,
    executable: l.executable || "",
    launcher: "steam",
  }));
}

async function syncOwnedLibrary(userId: string, steamId64: string) {
  const owned = await steamWebApiService.getOwnedGames(steamId64);

  const ownerships = owned.map((g) => ({
    providerGameId: String(g.appid),
    title: g.name,
    imageURL: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.appid}/library_600x900_2x.jpg`,
    installed: false,
    tags: [],
    launcher: "steam",
  }));

  await syncService.syncProviderGames({ provider: "steam", userId, ownerships });

  return owned.length;
}

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

  async getLoginUrl() {
    return steamOpenIdService.getLoginUrl(STEAM_RETURN_URL);
  }

  async connect(userId: string, body: any) {
    const { openIdParams, localGames = [] } = body;
    if (!openIdParams) {
      throw new AppError("Missing Steam sign-in response. Please try connecting again.", 400);
    }

    const steamId64 = await steamOpenIdService.verifyAssertion(openIdParams);
    if (!steamId64) {
      throw new AppError("Steam sign-in could not be verified. Please try again.", 401);
    }

    const summary = await steamWebApiService.getPlayerSummary(steamId64).catch(() => null);
    const displayName = summary?.personaname || "Steam User";

    await User.findByIdAndUpdate(userId, {
      $set: {
        "providers.steam": {
          steamId64,
          displayName,
          connectedAt: new Date(),
          lastSyncAt: new Date(),
        },
      },
    });

    await syncOwnedLibrary(userId, steamId64);

    if (localGames.length > 0) {
      await syncService.syncInstallationsOnly(userId, "steam", formatLocalGames(localGames));
    }

    const count = await gameLibrarymodel.countDocuments({ userId, "providers.steam": { $exists: true } });

    return {
      connected: true,
      displayName,
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

    const user = await User.findById(userId);
    const steamId64 = user?.providers?.steam?.steamId64;
    if (!steamId64) {
      throw new AppError("Steam account is not connected. Please reconnect.", 400);
    }

    const imported = await syncOwnedLibrary(userId, steamId64);

    if (localGames.length > 0) {
      await syncService.syncInstallationsOnly(userId, "steam", formatLocalGames(localGames));
    }

    await User.findByIdAndUpdate(userId, {
      $set: {
        "providers.steam.lastSyncAt": new Date(),
      },
    });

    const count = await gameLibrarymodel.countDocuments({ userId, "providers.steam": { $exists: true } });

    return {
      imported,
      totalGames: count,
    };
  }

  async refreshInstallations(userId: string, localGames: any[]) {
    return await syncService.syncInstallationsOnly(userId, "steam", formatLocalGames(localGames));
  }
}

export default new SteamProvider();
