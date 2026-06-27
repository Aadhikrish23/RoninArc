import gameLibrarymodel from "./LibraryGame";
import rawgService from "../rawg/rawgService";
import {
  normalizeTitle,
  validateMatch,
} from "../providers/shared/matcher/matcher";

class MetadataEnrichmentService {
  public async enrichGame(userId: string, gameId: string) {
    console.log(`[EnrichmentService] Enriching ${gameId}`);

    const game = await gameLibrarymodel.findOne({
      _id: gameId,
      userId,
    });

    if (!game) {
      throw new Error("Game not found");
    }

    // Already enriched
    if (game.metadataState?.status === "complete") {
      return game.toObject();
    }

    try {
      const normalizedTitle = normalizeTitle(game.title);

      const searchResults = await rawgService.searchGames(game.title, 10);
      console.log("RAWG Results:", searchResults?.length);

      if (searchResults?.length) {
        console.log("Top Result:", searchResults[0].name);
      }

      const candidates = (searchResults ?? []).slice(0, 10);

      let bestCandidate: any = null;
      let bestValidation = {
        accepted: false,
        score: 0,
        reason: "No candidate matched",
      };

      for (const candidate of candidates) {
        const validation = validateMatch(
          normalizedTitle,
          normalizeTitle(candidate.name),
        );

        if (validation.score > bestValidation.score) {
          bestValidation = validation;
          bestCandidate = candidate;
        }
      }
      console.log("Best Validation:", bestValidation);
      console.log("Best Candidate:", bestCandidate?.name);

      if (!bestValidation.accepted || !bestCandidate) {
        const failedGame = await gameLibrarymodel.findOneAndUpdate(
          {
            _id: gameId,
            userId,
          },
          {
            $set: {
              "metadataState.status": "failed",
              "metadataState.lastAttempt": new Date(),
              "metadataState.lastError": bestValidation.reason,
            },
          },
          {
            new: true,
          },
        );

        return failedGame?.toObject();
      }
      console.log("Fetching RAWG Details:", bestCandidate.id);
      const details = await rawgService.getGameDetails(bestCandidate.id);

      const updateFields: any = {
        rawgId: bestCandidate.id,

        screenshots: details.screenshots ?? [],
        trailers: details.trailers ?? [],

        rawgRating: details.rating ?? 0,
        metacritic: details.metacritic ?? null,

        website: details.website ?? "",
        playtime: details.playtime ?? 0,

        publishers: details.publishers ?? [],

        "metadataState.status": "complete",
        "metadataState.lastSuccess": new Date(),
        "metadataState.lastAttempt": new Date(),
        "metadataState.lastError": undefined,
      };

      // Provider metadata always wins.
      if (!game.developer) {
        updateFields.developers = details.developers ?? [];
      }

      const updatedGame = await gameLibrarymodel.findOneAndUpdate(
        {
          _id: gameId,
          userId,
        },
        {
          $set: updateFields,
        },
        {
          new: true,
          runValidators: true,
        },
      );

      console.log(`[EnrichmentService] Successfully enriched ${game.title}`);

      return updatedGame?.toObject();
    } catch (err: any) {
      const failedGame = await gameLibrarymodel.findOneAndUpdate(
        {
          _id: gameId,
          userId,
        },
        {
          $set: {
            "metadataState.status": "failed",
            "metadataState.lastAttempt": new Date(),
            "metadataState.lastError": err.message ?? String(err),
          },
        },
        {
          new: true,
        },
      );

      console.error(err);

      return failedGame?.toObject();
    }
  }
}

export default new MetadataEnrichmentService();
