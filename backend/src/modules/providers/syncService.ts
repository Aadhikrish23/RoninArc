import mongoose from "mongoose";
import EpicOwnership from "./epic/models/EpicOwnership";
import gameLibrarymodel from "../library/LibraryGame";
import activityService from "../activity/activityService";
import {
  normalizeTitle,
  isNonGame,
} from "./shared/matcher/matcher";

export interface SyncGameInput {
  providerGameId: string;
  title: string;
  description?: string;
  imageURL?: string;
  developer?: string;
  tags?: string[];
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
  console.log(`[SyncService] Starting sync for user ${userId} on provider "${provider}" with ${ownerships.length} ownerships.`);

  // Phase 2: Filter Non-Games
  const filteredGames = ownerships.filter((game) => {
    const skip = isNonGame(game.title);
    if (skip) {
      console.log(`[SyncService] Filtering out non-game title: "${game.title}"`);
    }
    return !skip;
  });

  console.log(`[SyncService] Passed filter: ${filteredGames.length}/${ownerships.length} ownerships.`);

  // Load existing library once for in-memory matching
  const existingGames = await gameLibrarymodel.find({ userId });
  console.log(`[SyncService] Loaded ${existingGames.length} existing games for user library.`);

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
      (g) => g.providers?.[provider]?.providerGameId === game.providerGameId
    );
    if (found && !matchedDbIds.has(found._id.toString())) {
      matchedGame = found;
    }

    // Priority 2: Match by legacy provider fields (for backward compatibility)
    if (!matchedGame) {
      found = existingGames.find(
        (g) => g.provider === provider && g.providerGameId === game.providerGameId
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
    const selectedSource = matchedGame?.artwork?.selectedSource || (artworkSources[provider] ? provider : "manual");

    // Preserve existing description/developer/tags or fall back to provider values
    const description = matchedGame?.description || game.description || "";
    const developer = matchedGame?.developer || game.developer || "";
    const tags = matchedGame?.tags && matchedGame.tags.length > 0 ? matchedGame.tags : (game.tags || []);

    const providerOwnershipInfo = {
      providerGameId: game.providerGameId,
      providerTitle: game.title,
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
      // New game insertion
      return {
        updateOne: {
          filter: {
            userId: new mongoose.Types.ObjectId(userId),
            // Match legacy compatibility fields or the specific provider key to avoid duplicates
            $or: [
              { provider, providerGameId: game.providerGameId },
              { [`providers.${provider}.providerGameId`]: game.providerGameId }
            ]
          },
          update: {
            $setOnInsert: {
              userId: new mongoose.Types.ObjectId(userId),
              status: "plan",
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

  // Execute single bulkWrite()
  if (bulkOps.length > 0) {
    console.log(`[SyncService] Committing ${bulkOps.length} bulk updates to MongoDB...`);
    const result = await gameLibrarymodel.bulkWrite(bulkOps);
    console.log(`[SyncService] Bulk write completed. Matches: ${result.matchedCount}, Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);

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
            id as any
          );
        }
      }
    }
  }

  // Phase 4: Clean up games that are no longer owned on this provider
  const allProviderGames = await gameLibrarymodel.find({
    userId,
    $or: [
      { [`providers.${provider}`]: { $exists: true } },
      { provider }
    ]
  });

  const missingGames = allProviderGames.filter(g => !matchedDbIds.has(g._id.toString()));
  
  if (missingGames.length > 0) {
    console.log(`[SyncService] Cleaning up ${missingGames.length} games no longer owned on provider "${provider}"...`);
    
    for (const game of missingGames) {
      // Check if there are other providers
      const otherProviders = Object.keys(game.providers || {}).filter(p => p !== provider);
      
      if (otherProviders.length === 0) {
        // No other providers. If the game has no user modifications (e.g. status is "plan", no ratings, no custom play session),
        // we can safely delete it. Otherwise, we just clear the provider fields.
        if (game.status === "plan" && !game.rating && !game.exePath) {
          await gameLibrarymodel.deleteOne({ _id: game._id });
          console.log(`[SyncService] Deleted game document for no-longer-owned game: "${game.title}"`);
        } else {
          // Keep the game but make it a manual game
          await gameLibrarymodel.updateOne(
            { _id: game._id },
            {
              $unset: { [`providers.${provider}`]: "" },
              $set: {
                provider: "manual",
                providerGameId: null,
                providerTitle: null
              }
            }
          );
          console.log(`[SyncService] Converted game to manual: "${game.title}"`);
        }
      } else {
        // Other providers exist, just remove this provider's ownership info
        await gameLibrarymodel.updateOne(
          { _id: game._id },
          {
            $unset: { [`providers.${provider}`]: "" }
          }
        );
        console.log(`[SyncService] Removed provider "${provider}" from game: "${game.title}"`);
      }
    }
  }

  console.log(`[SyncService] Completed sync run for provider "${provider}".`);
}

/**
 * Epic Games specific synchronization wrapper.
 */
export async function syncEpicGames(userId: string) {
  const epicGames = await EpicOwnership.find({ userId, owned: true });
  
  const gamesInput: SyncGameInput[] = epicGames.map((g) => ({
    providerGameId: g.catalogItemId || g.productId,
    title: g.title || "",
    description: g.description || undefined,
    imageURL: g.imageUrl || undefined,
    developer: g.developer || undefined,
    tags: [],
  }));

  await syncProviderGames({
    provider: "epic",
    userId,
    ownerships: gamesInput,
  });
}

export default {
  syncProviderGames,
  syncEpicGames,
};
