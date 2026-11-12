import epicApiService from "./epicApiService";
import EpicOwnership from "./models/EpicOwnership";
import epicAuthService from "./epicAuthService";

const METADATA_REQUESTS_AT_ONCE = 6;

const syncLibrary = async (userId: string) => {
  // Drop legacy index if it exists to allow duplicate productIds (base game + DLC)
  try {
    await EpicOwnership.collection.dropIndex("userId_1_productId_1");
    console.log("[EpicLibraryService] Dropped legacy unique index userId_1_productId_1");
  } catch (e) {
    // Index doesn't exist or already dropped, ignore
  }

  // Reset ownership status before syncing to handle removed/filtered items
  await EpicOwnership.updateMany({ userId, provider: "epic" }, { $set: { owned: false } });

  const accessToken = await epicAuthService.getValidAccessToken(userId);

  const uniqueGames = new Map();

  let cursor: string | undefined;

  do {
    const page = await epicApiService.getLibraryItems(accessToken, cursor);

    console.log("Fetched page:", page.records.length);

    for (const record of page.records) {
      if (record.recordType !== "APPLICATION") {
        continue;
      }
      uniqueGames.set(record.catalogItemId, record);
    }

    cursor = page.responseMetadata?.nextCursor;

    console.log("Next Cursor:", cursor);
  } while (cursor);

  console.log("Total Unique Games:", uniqueGames.size);

  let imported = 0;

  for (const game of uniqueGames.values()) {
    try {

      await EpicOwnership.updateOne(
        {
          userId,
          catalogItemId: game.catalogItemId,
        },
        {
          $set: {
            userId,
            productId: game.productId,
            catalogItemId: game.catalogItemId,
            namespace: game.namespace,
            appName: game.appName,
            title: game.sandboxName,
            owned: true,
            provider: "epic",
          },
        },
        {
          upsert: true,
        },
      );

      imported++;
    } catch (error) {
      // Only the message: a full axios/mongo error object can carry request headers and tokens.
      console.error("[SAVE FAILED]", error instanceof Error ? error.message : "unknown error");

      throw error;
    }
  }

  return {
    imported,
    totalGames: uniqueGames.size,
  };
};

const syncMetadata = async (userId: string) => {
  const accessToken = await epicAuthService.getValidAccessToken(userId);

  const games = await EpicOwnership.find({
    userId,
  });

  let updated = 0;

  const fetchMetadata = async (game: (typeof games)[number]) => {
    try {
      if (!game.namespace || !game.catalogItemId) {
        return;
      }

      const metadata = await epicApiService.getCatalogItem(
        accessToken,
        game.namespace,
        game.catalogItemId,
      );

      const item = metadata[game.catalogItemId];

      if (!item) {
        return;
      }

      const heroImage = item.keyImages?.find(
        (img: any) =>
          img.type === "DieselGameBox" || img.type === "DieselGameBoxTall",
      );

      await EpicOwnership.updateOne(
        {
          _id: game._id,
        },
        {
          $set: {
            title: item.title,

            description: item.description,

            developer: item.developer,

            imageUrl: heroImage?.url || null,

            productSlug: item.productSlug || null,
          },
        },
      );

      updated++;
    } catch (error) {
      console.log("[METADATA FAILED]", game.catalogItemId);
    }
  };

  // One at a time, a 265-game library took over a minute.
  const queue = [...games];
  await Promise.all(
    Array.from({ length: METADATA_REQUESTS_AT_ONCE }, async () => {
      for (let game = queue.shift(); game; game = queue.shift()) {
        await fetchMetadata(game);
      }
    }),
  );

  return {
    updated,
  };
};
const debugLibrary = async (userId: string) => {
  const accessToken = await epicAuthService.getValidAccessToken(userId);

  const library = await epicApiService.getLibraryItems(accessToken);

  return {
    records: library.records?.length || 0,
  };
};

export default {
  syncLibrary,
  syncMetadata,
  debugLibrary,
};
