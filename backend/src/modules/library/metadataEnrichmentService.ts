import gameLibrarymodel from "./LibraryGame";
import rawgService from "../rawg/rawgService";
import { normalizeTitle, validateMatch } from "../providers/shared/matcher/matcher";

class MetadataEnrichmentService {
  private workerActive = false;
  private COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown for failed enrichments

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker() {
    try {
      // Recovery logic: Reset any stuck "enriching" jobs back to "pending" on server start/restart
      const result = await gameLibrarymodel.updateMany(
        { "metadataState.status": "enriching" },
        { $set: { "metadataState.status": "pending" } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[EnrichmentService] Recovered ${result.modifiedCount} stuck enrichment jobs.`);
      }
    } catch (err) {
      console.error("[EnrichmentService] Error recovering stuck jobs:", err);
    }
    this.wakeWorker();
  }

  /**
   * Enqueue a game for metadata enrichment in the database.
   * This operation is idempotent and atomic, preventing duplicates and concurrent execution.
   */
  public enqueueEnrichment(userId: string, gameId: string): void {
    const cooldownLimit = new Date(Date.now() - this.COOLDOWN_MS);

    // Atomically check eligibility and transition to "pending" in the DB.
    // If status is pending, enriching, or complete, this query fails to find the game
    // and does nothing, preventing duplicate jobs.
    gameLibrarymodel.updateOne(
      {
        _id: gameId,
        userId,
        $or: [
          { "metadataState.status": "none" },
          { "metadataState.status": { $exists: false } },
          {
            "metadataState.status": "failed",
            "metadataState.lastAttempt": { $lt: cooldownLimit }
          }
        ]
      },
      {
        $set: {
          "metadataState.status": "pending",
          "metadataState.lastAttempt": new Date(),
        }
      }
    ).then((result) => {
      if (result.modifiedCount > 0) {
        console.log(`[EnrichmentService] Game ${gameId} successfully enqueued in database.`);
        this.wakeWorker();
      }
    }).catch((err) => {
      console.error(`[EnrichmentService] Error enqueuing game ${gameId}:`, err);
    });
  }

  private wakeWorker(): void {
    if (this.workerActive) return;
    this.runWorkerLoop().catch((err) => {
      console.error("[EnrichmentService] Background worker loop failed:", err);
      this.workerActive = false;
    });
  }

  private async runWorkerLoop(): Promise<void> {
    this.workerActive = true;
    console.log("[EnrichmentService] Background worker started.");

    while (true) {
      try {
        // Atomic state transition: Find a pending job and atomically set its status to "enriching".
        // This is safe even if multiple worker instances or processes are running concurrently.
        const game = await gameLibrarymodel.findOneAndUpdate(
          { "metadataState.status": "pending" },
          {
            $set: {
              "metadataState.status": "enriching",
              "metadataState.lastAttempt": new Date(),
            }
          },
          { new: true }
        );

        if (!game) {
          console.log("[EnrichmentService] No pending jobs. Worker going to sleep.");
          this.workerActive = false;
          break;
        }

        // Process this job!
        await this.enrichGame(game.userId.toString(), game._id.toString());
      } catch (err) {
        console.error("[EnrichmentService] Error in worker loop iteration:", err);
        // Wait 5 seconds before next loop if Mongoose/MongoDB query errors
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async enrichGame(userId: string, gameId: string): Promise<void> {
    console.log(`[EnrichmentService] Enriching game ${gameId}...`);
    const game = await gameLibrarymodel.findOne({ _id: gameId, userId });
    if (!game) {
      console.log(`[EnrichmentService] Game ${gameId} not found, skipping.`);
      return;
    }

    try {
      const normTitle = normalizeTitle(game.title);
      const searchResults = await rawgService.searchGames(game.title, 1);
      const candidates = (searchResults || []).slice(0, 10);

      let bestCandidate: any = null;
      let bestValidation = { accepted: false, score: 0, reason: "No candidate matched" };

      for (const candidate of candidates) {
        const normRawg = normalizeTitle(candidate.name);
        const validation = validateMatch(normTitle, normRawg);
        if (validation.score > bestValidation.score) {
          bestValidation = validation;
          bestCandidate = candidate;
        }
      }

      if (bestValidation.accepted && bestCandidate) {
        console.log(`[EnrichmentService] Confident match found: "${bestCandidate.name}" with score ${bestValidation.score}%`);
        
        // Fetch full RAWG details
        const details = await rawgService.getGameDetails(bestCandidate.id);

        // --- PRESERVE PROVIDER AUTHORITY RULE ---
        // Provider metadata is authoritative and immutable.
        // Never overwrite: title, description, artwork, developer, tags, or provider ownership information.
        // RAWG enrichment is allowed to populate only: screenshots, trailers, website, rawgRating, metacritic, playtime, publishers, and developers (if not supplied).
        const updateFields: any = {
          rawgId: bestCandidate.id,
          screenshots: details.screenshots || [],
          trailers: details.trailers || [],
          rawgRating: details.rating || 0,
          metacritic: details.metacritic || null,
          website: details.website || "",
          playtime: details.playtime || 0,
          publishers: details.publishers || [],
          "metadataState.status": "complete",
          "metadataState.lastSuccess": new Date(),
          "metadataState.lastAttempt": new Date(),
          "metadataState.lastError": undefined,
        };

        // Only populate developers list if the provider did not supply a developer
        if (!game.developer) {
          updateFields.developers = details.developers || [];
        }

        await gameLibrarymodel.updateOne({ _id: gameId, userId }, { $set: updateFields });
        console.log(`[EnrichmentService] Enrichment successfully completed for game ${gameId}`);
      } else {
        console.log(`[EnrichmentService] Enrichment failed: Match rejected. Reason: ${bestValidation.reason}`);
        await gameLibrarymodel.updateOne(
          { _id: gameId, userId },
          {
            $set: {
              "metadataState.status": "failed",
              "metadataState.lastAttempt": new Date(),
              "metadataState.lastError": `Match validation rejected: ${bestValidation.reason}`,
            }
          }
        );
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      console.error(`[EnrichmentService] Enrichment error for game ${gameId}:`, errMsg);
      await gameLibrarymodel.updateOne(
        { _id: gameId, userId },
        {
          $set: {
            "metadataState.status": "failed",
            "metadataState.lastAttempt": new Date(),
            "metadataState.lastError": `API error: ${errMsg}`,
          }
        }
      );
    }
  }
}

export default new MetadataEnrichmentService();
