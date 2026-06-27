import mongoose from "mongoose";
import EpicOwnership from "./epic/models/EpicOwnership";
import gameLibrarymodel from "../library/LibraryGame";
import Review from "../review/Reviewmodel";
import activityService from "../activity/activityService";
import { normalizeTitle, isNonGame } from "./shared/matcher/matcher";

export interface SyncGameInput {
  providerGameId: string;
  title: string;
  description?: string;
  imageURL?: string;
  developer?: string;
  tags?: string[];
  installed?: boolean;
  installPath?: string;
  manifestId?: string;
  executable?: string;
  launcher?: string;
}

export interface SyncProviderGamesParams {
  provider: "epic" | "steam" | "gog" | "ea" | "ubisoft" | "xbox";
  userId: string;
  ownerships: SyncGameInput[];
}

/**
 * Generic provider-agnostic synchronization pipeline.
 */
export async function syncProviderGames({
  provider,
  userId,
  ownerships,
}: SyncProviderGamesParams) {
  console.log("Ownerships received:", ownerships.length);

  // Phase 2: Filter Non-Games
  const filteredGames = ownerships.filter((game) => {
    const skip = isNonGame(game.title);
    if (skip) {
      console.log(
        `[SyncService] Filtering out non-game title: "${game.title}"`,
      );
    }
    return !skip;
  });

  console.log("Filtered games:", filteredGames.length);

  // Load existing library once for in-memory matching
  const existingGames = await gameLibrarymodel.find({ userId });
  

  const matchedDbIds = new Set<string>();

  // Process game sync in memory
  const processedGames = filteredGames.map((game) => {
    const normTitle = normalizeTitle(game.title);

    // Duplicate Handling: Match Priority
    // 1. providers.[provider].providerGameId
    // 2. legacy provider === provider && providerGameId === game.providerGameId
    // 3. normalizedTitle
    // 4. providerTitle
    let matchedGame: any = null;

    // Priority 1: Match by providers.[provider].providerGameId
    let found = existingGames.find(
      (g) => g.providers?.[provider]?.providerGameId === game.providerGameId,
    );
    if (found && !matchedDbIds.has(found._id.toString())) {
      matchedGame = found;
    }

    // Priority 2: Match by legacy provider fields (for backward compatibility)
    if (!matchedGame) {
      found = existingGames.find(
        (g) =>
          g.provider === provider && g.providerGameId === game.providerGameId,
      );
      if (found && !matchedDbIds.has(found._id.toString())) {
        matchedGame = found;
      }
    }

    // Priority 3: Match by normalizedTitle
    if (!matchedGame) {
      found = existingGames.find((g) => g.normalizedTitle === normTitle);
      if (found && !matchedDbIds.has(found._id.toString())) {
        matchedGame = found;
      }
    }

    // Priority 4: Match by providerTitle
    if (!matchedGame) {
      found = existingGames.find((g) => g.providerTitle === game.title);
      if (found && !matchedDbIds.has(found._id.toString())) {
        matchedGame = found;
      }
    }

    if (matchedGame) {
      matchedDbIds.add(matchedGame._id.toString());
    }

    return {
      game,
      normTitle,
      matchedGame,
    };
  });

  // Prepare Bulk Write operations
  const bulkOps = processedGames.map((item) => {
    const { game, normTitle, matchedGame } = item;

    // Gather existing artwork sources
    const artworkSources: Record<string, string> = {
      ...(matchedGame?.artwork?.sources || {}),
    };

    // Save provider image
    if (game.imageURL) {
      artworkSources[provider] = game.imageURL;
    }

    // Determine dynamic selected source: if existing game has a selected source, keep it
    const selectedSource =
      matchedGame?.artwork?.selectedSource ||
      (artworkSources[provider] ? provider : "manual");

    // Preserve existing description/developer/tags or fall back to provider values
    const description = matchedGame?.description || game.description || "";
    const developer = matchedGame?.developer || game.developer || "";
    const tags =
      matchedGame?.tags && matchedGame.tags.length > 0
        ? matchedGame.tags
        : game.tags || [];

    // Preserve existing installation state during online ownership sync if it already exists in the matched game document
    const existingInstalled =
      matchedGame?.providers?.[provider]?.installed ?? false;
    const existingInstallPath =
      matchedGame?.providers?.[provider]?.installPath ?? "";
    const existingExecutable =
      matchedGame?.providers?.[provider]?.executable ?? "";
    const existingLauncher =
      matchedGame?.providers?.[provider]?.launcher ?? provider;
    const existingManifestId =
      matchedGame?.providers?.[provider]?.manifestId ?? "";

    const providerOwnershipInfo = {
      providerGameId: game.providerGameId,
      providerTitle: game.title,
      owned: true,
      installed: game.installed || existingInstalled,
      installPath: game.installPath || existingInstallPath,
      launcher: game.launcher || existingLauncher,
      manifestId: game.manifestId || existingManifestId,
      executable: game.executable || existingExecutable,
      syncedAt: new Date(),
    };

    if (matchedGame) {
      // Update existing game. Never overwrite user-managed fields or existing RAWG enrichment data!
      const updateData: any = {
        [`providers.${provider}`]: providerOwnershipInfo,
        // Sync legacy compatibility fields
        provider,
        providerGameId: game.providerGameId,
        providerTitle: game.title,
        normalizedTitle: normTitle,
        description,
        developer,
        tags,
        "artwork.selectedSource": selectedSource,
        "artwork.sources": artworkSources,
      };

      return {
        updateOne: {
          filter: { _id: matchedGame._id },
          update: {
            $set: updateData,
          },
        },
      };
    } else {
      // New game insertion - default progressStatus to "none"
      return {
        updateOne: {
          filter: {
            userId: new mongoose.Types.ObjectId(userId),
            // Match legacy compatibility fields or the specific provider key to avoid duplicates
            $or: [
              { provider, providerGameId: game.providerGameId },
              { [`providers.${provider}.providerGameId`]: game.providerGameId },
            ],
          },
          update: {
            $setOnInsert: {
              userId: new mongoose.Types.ObjectId(userId),
              progressStatus: "none",
              exePath: "",
              rating: null,
            },
            $set: {
              title: game.title,
              provider,
              providerGameId: game.providerGameId,
              providerTitle: game.title,
              normalizedTitle: normTitle,
              description,
              developer,
              tags,
              [`providers.${provider}`]: providerOwnershipInfo,
              artwork: {
                selectedSource,
                sources: artworkSources,
              },
            },
          },
          upsert: true,
        },
      };
    }
  });
  console.log("Bulk operations:", bulkOps.length);
  // Execute single bulkWrite()
  if (bulkOps.length > 0) {
    
    console.log("Executing bulkWrite...");
    const result = await gameLibrarymodel.bulkWrite(bulkOps);
   console.log(result);

    // Create Activity logs for newly upserted games
    if (result && result.upsertedIds) {
      for (const [indexStr, id] of Object.entries(result.upsertedIds)) {
        const index = parseInt(indexStr, 10);
        const item = processedGames[index];
        if (item) {
          await activityService.createActivity(
            userId,
            "GAME_ADDED",
            `Imported ${item.game.title} from ${provider.toUpperCase()}`,
            id as any,
          );
        }
      }
    }
  }

  // Phase 4: Clean up games that are no longer owned on this provider
  const allProviderGames = await gameLibrarymodel.find({
    userId,
    $or: [{ [`providers.${provider}`]: { $exists: true } }, { provider }],
  });
  const ownedProviderIds = new Set(
    filteredGames.map(g => g.providerGameId)
);

  const missingGames = allProviderGames.filter((g) => {
    const providerGameId =
        g.providers?.[provider]?.providerGameId ??
        g.providerGameId;

    return !ownedProviderIds.has(providerGameId);
});

  if (missingGames.length > 0) {
    if (provider === "steam") {
      // For Steam, missing from scan means it's uninstalled, but still owned.
      // Set installed to false, keep ownership.
      console.log(
        `[SyncService] Marking ${missingGames.length} Steam games as uninstalled.`,
      );
      await gameLibrarymodel.updateMany(
        { _id: { $in: missingGames.map((g) => g._id) } },
        { $set: { "providers.steam.installed": false } },
      );
    } else {
      console.log(
        `[SyncService] Cleaning up ${missingGames.length} games no longer owned on provider "${provider}"...`,
      );

      for (const game of missingGames) {
        // Check if there are other providers
        const otherProviders = Object.keys(game.providers || {}).filter(
          (p) => p !== provider,
        );

        if (otherProviders.length === 0) {
          // No other providers. If the game has no user modifications (e.g. progressStatus is "none"/"plan", no ratings, no custom play session),
          // we can safely delete it. Otherwise, we just clear the provider fields.
          const reviewExists = await Review.exists({
            userId,
            gameId: game._id,
          });
          if (
            (game.progressStatus === "none" ||
              game.progressStatus === "plan") &&
            !reviewExists &&
            !game.exePath
          ) {
            await gameLibrarymodel.deleteOne({ _id: game._id });
            console.log(
              `[SyncService] Deleted game document for no-longer-owned game: "${game.title}"`,
            );
          } else {
            // Keep the game but make it a manual game
            await gameLibrarymodel.updateOne(
              { _id: game._id },
              {
                $unset: { [`providers.${provider}`]: "" },
                $set: {
                  provider: "manual",
                  providerGameId: null,
                  providerTitle: null,
                },
              },
            );
            console.log(
              `[SyncService] Converted game to manual: "${game.title}"`,
            );
          }
        } else {
          // Other providers exist, just remove this provider's ownership info
          await gameLibrarymodel.updateOne(
            { _id: game._id },
            {
              $unset: { [`providers.${provider}`]: "" },
            },
          );
          console.log(
            `[SyncService] Removed provider "${provider}" from game: "${game.title}"`,
          );
        }
      }
    }
  }

  console.log(`[SyncService] Completed sync run for provider "${provider}".`);
  if (bulkOps.length > 0) {
    console.log(
      `[SyncService] Committing ${bulkOps.length} bulk updates to MongoDB...`,
    );

    console.log(`[SyncService] Completed sync run for provider "${provider}".`);
  }
}
/**
 * Epic Games specific synchronization wrapper.
 */
export async function syncEpicGames(userId: string, localGames: any[] = []) {
    console.log("========== ENTERED syncEpicGames ==========");
  const epicGames = await EpicOwnership.find({ userId, owned: true });
  console.log("Epic games found:", epicGames.length);
  
  console.log(epicGames[0]);

  const gamesInput: SyncGameInput[] = epicGames.map((g) => {
    
    // Match local scanned installed games by catalogItemId
    const local = localGames.find((l) => l.catalogItemId === g.catalogItemId);

    return {
      providerGameId: g.catalogItemId || g.productId,
      title: g.title || "",
      description: g.description || undefined,
      imageURL: g.imageUrl || undefined,
      developer: g.developer || undefined,
      tags: [],
      installed: !!local,
      installPath: local?.installPath || undefined,
      manifestId: local?.epicId || undefined,
      executable: local?.executable || undefined,
      launcher: "epic",
    };
  });
  console.log("Games Input:", gamesInput.length);
    console.log(gamesInput[0]);
console.log("Calling syncProviderGames...");
  await syncProviderGames({
    provider: "epic",
    userId,
    ownerships: gamesInput,
  });
}

/**
 * Steam Games synchronization wrapper.
 */
export async function syncSteamGames(userId: string, localGames: any[] = []) {
  const gamesInput: SyncGameInput[] = localGames.map((g) => ({
    providerGameId: g.appId,
    title: g.name,
    description: "",
    imageURL: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.appId}/library_600x900_2x.jpg`,
    developer: "",
    tags: [],
    installed: true,
    installPath: g.installPath,
    manifestId: g.appId,
    executable: g.executable || "",
    launcher: "steam",
  }));

  await syncProviderGames({
    provider: "steam",
    userId,
    ownerships: gamesInput,
  });
}

/**
 * Clean up provider ownership fields when disconnecting a provider.
 */
export async function disconnectProviderGames(
  userId: string,
  provider: string,
) {
  console.log(
    `[SyncService] Disconnecting provider "${provider}" for user ${userId}`,
  );
  const games = await gameLibrarymodel.find({
    userId,
    $or: [{ [`providers.${provider}`]: { $exists: true } }, { provider }],
  });

  for (const game of games) {
    const otherProviders = Object.keys(game.providers || {}).filter(
      (p) => p !== provider,
    );

    if (otherProviders.length === 0) {
      const reviewExists = await Review.exists({ userId, gameId: game._id });
      if (
        (game.progressStatus === "none" || game.progressStatus === "plan") &&
        !reviewExists &&
        !game.exePath
      ) {
        await gameLibrarymodel.deleteOne({ _id: game._id });
        console.log(
          `[SyncService] Deleted game document during disconnect: "${game.title}"`,
        );
      } else {
        await gameLibrarymodel.updateOne(
          { _id: game._id },
          {
            $unset: { [`providers.${provider}`]: "" },
            $set: {
              provider: "manual",
              providerGameId: null,
              providerTitle: null,
            },
          },
        );
      }
    } else {
      await gameLibrarymodel.updateOne(
        { _id: game._id },
        {
          $unset: { [`providers.${provider}`]: "" },
        },
      );
    }
  }
}

export async function syncInstallationsOnly(
  userId: string,
  provider: string,
  localGames: SyncGameInput[],
) {
  console.log(
    `[SyncService] Starting installation-only sync for user ${userId} on provider "${provider}" with ${localGames.length} scanned games.`,
  );

  // 1. Get all library games for this user that currently have this provider defined
  const existingGames = await gameLibrarymodel.find({
    userId,
    $or: [{ [`providers.${provider}`]: { $exists: true } }, { provider }],
  });

  const matchedDbIds = new Set<string>();
  const bulkOps = [];
  let updated = 0;
  let installedCount = 0;
  let removedCount = 0;

  // 2. Map scanned games and look for matches in the existing library
  for (const game of localGames) {
    const normTitle = normalizeTitle(game.title);
    let matchedGame: any = null;

    let found = existingGames.find(
      (g) => g.providers?.[provider]?.providerGameId === game.providerGameId,
    );
    if (found && !matchedDbIds.has(found._id.toString())) {
      matchedGame = found;
    }

    if (!matchedGame) {
      found = existingGames.find(
        (g) =>
          g.provider === provider && g.providerGameId === game.providerGameId,
      );
      if (found && !matchedDbIds.has(found._id.toString())) {
        matchedGame = found;
      }
    }

    if (!matchedGame) {
      found = existingGames.find((g) => g.normalizedTitle === normTitle);
      if (found && !matchedDbIds.has(found._id.toString())) {
        matchedGame = found;
      }
    }

    if (!matchedGame) {
      found = existingGames.find((g) => g.providerTitle === game.title);
      if (found && !matchedDbIds.has(found._id.toString())) {
        matchedGame = found;
      }
    }

    if (matchedGame) {
      matchedDbIds.add(matchedGame._id.toString());
      installedCount++;

      const current = matchedGame.providers?.[provider] || {};
      const hasChanged =
        current.installed !== true ||
        current.installPath !== game.installPath ||
        current.executable !== game.executable ||
        current.launcher !== (game.launcher || provider) ||
        current.manifestId !== game.manifestId;

      if (hasChanged) {
        updated++;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: matchedGame._id },
          update: {
            $set: {
              [`providers.${provider}.installed`]: true,
              [`providers.${provider}.installPath`]: game.installPath || "",
              [`providers.${provider}.executable`]: game.executable || "",
              [`providers.${provider}.launcher`]: game.launcher || provider,
              [`providers.${provider}.manifestId`]: game.manifestId || "",
              [`providers.${provider}.syncedAt`]: new Date(),
            },
          },
        },
      });
    } else {
      // If provider is Steam, we MUST insert it because Steam only supports installed games and has no online import!
      if (provider === "steam") {
        installedCount++;
        updated++;
        const artworkSources: Record<string, string> = {};
        if (game.imageURL) {
          artworkSources[provider] = game.imageURL;
        }
        const selectedSource = game.imageURL ? provider : "manual";

        bulkOps.push({
          updateOne: {
            filter: {
              userId: new mongoose.Types.ObjectId(userId),
              [`providers.${provider}.providerGameId`]: game.providerGameId,
            },
            update: {
              $setOnInsert: {
                userId: new mongoose.Types.ObjectId(userId),
                progressStatus: "none",
                exePath: "",
                rating: null,
              },
              $set: {
                title: game.title,
                provider,
                providerGameId: game.providerGameId,
                providerTitle: game.title,
                normalizedTitle: normTitle,
                description: "",
                developer: "",
                tags: [],
                [`providers.${provider}`]: {
                  providerGameId: game.providerGameId,
                  providerTitle: game.title,
                  owned: true,
                  installed: true,
                  installPath: game.installPath || "",
                  launcher: game.launcher || provider,
                  manifestId: game.manifestId || "",
                  executable: game.executable || "",
                  syncedAt: new Date(),
                },
                artwork: {
                  selectedSource,
                  sources: artworkSources,
                },
              },
            },
            upsert: true,
          },
        });
      }
    }
  }

  // 3. Mark games missing from scan as uninstalled
  const missingGames = existingGames.filter(
    (g) => !matchedDbIds.has(g._id.toString()),
  );
  for (const game of missingGames) {
    const current = game.providers?.[provider] || {};
    if (current.installed) {
      removedCount++;
      updated++;
      bulkOps.push({
        updateOne: {
          filter: { _id: game._id },
          update: {
            $set: {
              [`providers.${provider}.installed`]: false,
            },
          },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await gameLibrarymodel.bulkWrite(bulkOps);
  }

  return {
    scanned: localGames.length,
    updated,
    installed: installedCount,
    removed: removedCount,
  };
}

export default {
  syncProviderGames,
  syncEpicGames,
  syncSteamGames,
  disconnectProviderGames,
  syncInstallationsOnly,
};
