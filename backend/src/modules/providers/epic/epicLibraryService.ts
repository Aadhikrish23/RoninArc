import epicApiService from "./epicApiService";
import EpicOwnership from "./models/EpicOwnership";
import epicAuthService from "./epicAuthService";

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
      console.log("[IMPORTING]", game.catalogItemId, game.sandboxName);

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
      console.error("[SAVE FAILED]");

      console.dir(error, {
        depth: 10,
      });

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

  for (const game of games) {
    try {
      if (!game.namespace || !game.catalogItemId) {
        continue;
      }

      const metadata = await epicApiService.getCatalogItem(
        accessToken,
        game.namespace,
        game.catalogItemId,
      );

      const item = metadata[game.catalogItemId];

      if (!item) {
        continue;
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
  }

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
