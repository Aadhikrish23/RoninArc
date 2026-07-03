// TEMP DEBUG ONLY

import libraryServices from "../../library/libraryServices";
import { LibraryGame } from "./LibraryGame";
import { EntityResolutionStatus } from "./EntityResolutionStatus";
import { EntityResolutionResult } from "./EntityResolutionResult";
import { GameNameNormalizer } from "./GameNameNormalizer";
import entityLearningResolver from "./EntityLearningResolver";
import { EXACT_CONFIDENCE, FUZZY_RESOLVED_THRESHOLD, FUZZY_AMBIGUOUS_THRESHOLD } from "./EntityResolutionConstants";
import { distance } from "fastest-levenshtein";
import aiTraceLogger from "../debug/AITraceLogger";

export class EntityResolver {
  /**
   * Resolves a human-readable game name to a structured EntityResolutionResult<LibraryGame>.
   */
  async resolveGame(
    userId: string,
    gameName: string,
  ): Promise<EntityResolutionResult<LibraryGame>> {
    const trace = aiTraceLogger.current();
    
    const normQuery = this.normalizeQuery(gameName);

    const traceInfo = {
      originalQuery: gameName,
      normalizedQuery: normQuery,
      exactMatchResult: "NONE",
      learningMemoryResult: "NONE",
      fuzzyCandidates: [] as any[],
      chosenStrategy: "NONE",
      finalConfidence: 0,
      finalResolutionStatus: "NOT_FOUND",
    };

    const games = (await libraryServices.getUserLibrary(userId)) as LibraryGame[];

    // 1. Exact Match (with normalized names)
    const exactMatches = this.tryExactMatch(games, normQuery);

    if (exactMatches.length === 1) {
      const resolvedGame = exactMatches[0];
      const result = this.buildResult(
        EntityResolutionStatus.RESOLVED,
        EXACT_CONFIDENCE,
        resolvedGame,
        undefined,
        `Exactly one exact match found: "${resolvedGame.title}"`,
      );

      traceInfo.exactMatchResult = `RESOLVED: ${resolvedGame.title}`;
      traceInfo.chosenStrategy = "Exact Match";
      traceInfo.finalConfidence = EXACT_CONFIDENCE;
      traceInfo.finalResolutionStatus = "RESOLVED";

      if (trace) {
        trace.log("EntityResolver", "Resolution Trace", traceInfo);
      }

      return result;
    }

    if (exactMatches.length > 1) {
      const result = this.buildResult(
        EntityResolutionStatus.AMBIGUOUS,
        0.5,
        undefined,
        exactMatches,
        `Multiple exact matches found for query: "${gameName}"`,
      );

      traceInfo.exactMatchResult = `AMBIGUOUS: ${exactMatches.length} candidates`;
      traceInfo.chosenStrategy = "Exact Match";
      traceInfo.finalConfidence = 0.5;
      traceInfo.finalResolutionStatus = "AMBIGUOUS";

      if (trace) {
        trace.log("EntityResolver", "Resolution Trace", traceInfo);
      }

      return result;
    }

    // 2. Learning Memory Lookup
    const learnedGame = await this.tryLearnedMatch(userId, normQuery, games);
    if (learnedGame) {
      const result = this.buildResult(
        EntityResolutionStatus.RESOLVED,
        EXACT_CONFIDENCE,
        learnedGame,
        undefined,
        `Resolved via learned alias memory: "${learnedGame.title}"`,
      );

      traceInfo.learningMemoryResult = `RESOLVED: ${learnedGame.title}`;
      traceInfo.chosenStrategy = "Learning Memory";
      traceInfo.finalConfidence = EXACT_CONFIDENCE;
      traceInfo.finalResolutionStatus = "RESOLVED";

      if (trace) {
        trace.log("EntityResolver", "Resolution Trace", traceInfo);
      }

      return result;
    }

    // 3. Fuzzy Match
    const scoredGames = this.tryFuzzyMatch(games, normQuery);

    traceInfo.fuzzyCandidates = scoredGames.slice(0, 5).map(c => ({
      title: c.game.title,
      score: c.score,
    }));

    if (scoredGames.length > 0) {
      const maxScore = scoredGames[0].score;

      if (maxScore >= FUZZY_RESOLVED_THRESHOLD) {
        const bestMatches = scoredGames.filter(c => c.score >= FUZZY_RESOLVED_THRESHOLD);

        if (bestMatches.length === 1) {
          const resolvedGame = bestMatches[0].game;
          const result = this.buildResult(
            EntityResolutionStatus.RESOLVED,
            bestMatches[0].score,
            resolvedGame,
            undefined,
            `Fuzzy resolved with confidence ${bestMatches[0].score.toFixed(2)}: "${resolvedGame.title}"`,
          );

          traceInfo.chosenStrategy = "Fuzzy Match (Resolved)";
          traceInfo.finalConfidence = bestMatches[0].score;
          traceInfo.finalResolutionStatus = "RESOLVED";

          if (trace) {
            trace.log("EntityResolver", "Resolution Trace", traceInfo);
          }

          return result;
        } else {
          const candidates = bestMatches.map(c => c.game);
          const result = this.buildResult(
            EntityResolutionStatus.AMBIGUOUS,
            maxScore,
            undefined,
            candidates,
            `Multiple fuzzy matches with high similarity >= ${FUZZY_RESOLVED_THRESHOLD} for query: "${gameName}"`,
          );

          traceInfo.chosenStrategy = "Fuzzy Match (Ambiguous)";
          traceInfo.finalConfidence = maxScore;
          traceInfo.finalResolutionStatus = "AMBIGUOUS";

          if (trace) {
            trace.log("EntityResolver", "Resolution Trace", traceInfo);
          }

          return result;
        }
      }

      if (maxScore >= FUZZY_AMBIGUOUS_THRESHOLD) {
        const ambiguousMatches = scoredGames.filter(c => c.score >= FUZZY_AMBIGUOUS_THRESHOLD);
        const candidates = ambiguousMatches.map(c => c.game);
        const result = this.buildResult(
          EntityResolutionStatus.AMBIGUOUS,
          maxScore,
          undefined,
          candidates,
          `Fuzzy matched in ambiguous range [${FUZZY_AMBIGUOUS_THRESHOLD}, ${FUZZY_RESOLVED_THRESHOLD}) with max confidence ${maxScore.toFixed(2)}`,
        );

        traceInfo.chosenStrategy = "Fuzzy Match (Ambiguous Range)";
        traceInfo.finalConfidence = maxScore;
        traceInfo.finalResolutionStatus = "AMBIGUOUS";

        if (trace) {
          trace.log("EntityResolver", "Resolution Trace", traceInfo);
        }

        return result;
      }
    }

    // 4. Default: NOT_FOUND
    const result = this.buildResult(
      EntityResolutionStatus.NOT_FOUND,
      0,
      undefined,
      undefined,
      `No matches found matching exact, learned, or fuzzy thresholds for: "${gameName}"`,
    );

    traceInfo.chosenStrategy = "None (Not Found)";
    traceInfo.finalConfidence = 0;
    traceInfo.finalResolutionStatus = "NOT_FOUND";

    if (trace) {
      trace.log("EntityResolver", "Resolution Trace", traceInfo);
    }

    return result;
  }

  private normalizeQuery(gameName: string): string {
    return GameNameNormalizer.normalize(gameName);
  }

  private tryExactMatch(games: LibraryGame[], normQuery: string): LibraryGame[] {
    return games.filter(
      (game) => GameNameNormalizer.normalize(game.title) === normQuery,
    );
  }

  private async tryLearnedMatch(userId: string, normQuery: string, games: LibraryGame[]): Promise<LibraryGame | null> {
    const learnedId = await entityLearningResolver.resolve(userId, normQuery);
    if (learnedId) {
      return games.find((g) => g.title.toLowerCase() === learnedId.toLowerCase() || g._id.toString() === learnedId) || null;
    }
    return null;
  }

  private tryFuzzyMatch(games: LibraryGame[], normQuery: string): { game: LibraryGame; score: number }[] {
    const scored = games.map((game) => {
      const normTitle = GameNameNormalizer.normalize(game.title);
      const maxLen = Math.max(normQuery.length, normTitle.length);
      const score = maxLen > 0 ? 1 - distance(normQuery, normTitle) / maxLen : 0;
      return { game, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  private buildResult(
    status: EntityResolutionStatus,
    confidence: number,
    entity?: LibraryGame,
    candidates?: LibraryGame[],
    reasoning?: string,
  ): EntityResolutionResult<LibraryGame> {
    return {
      status,
      confidence,
      entity,
      candidates,
      reasoning,
    };
  }
}

export default new EntityResolver();
