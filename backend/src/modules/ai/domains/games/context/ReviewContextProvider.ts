import reviewService from "../../../../review/reviewService";
import libraryServices from "../../../../library/libraryServices";
import { ContextProvider } from "../../../context/ContextProvider";
import { ContextCategory } from "../../../context/ContextCategory";
import { ContextRequest } from "../../../context/ContextRequest";
import { ContextResult } from "../../../context/ContextResult";
import { ContextFact } from "../../../context/ContextFact";
import { IntentTargetType } from "../../../intent/IntentTargetType";

export class ReviewContextProvider implements ContextProvider {
  readonly category = ContextCategory.Reviews;

  /**
   * Resolves review facts for game targets defined in request.
   */
  async build(request: ContextRequest): Promise<ContextResult> {
    const facts: ContextFact[] = [];

    const gameTargets = request.targets.filter(
      (t) => t.type === IntentTargetType.Game,
    );

    for (const target of gameTargets) {
      const libraryGames = await libraryServices.getGameFilter(
        request.userId,
        "title",
        target.name,
      );

      if (libraryGames && libraryGames.length > 0) {
        for (const game of libraryGames) {
          const review = await reviewService.getReview(
            request.userId,
            game._id.toString(),
          );

          if (review) {
            facts.push({
              category: this.category,
              value: review,
              confidence: 1.0,
              source: "ReviewDatabase",
              timestamp: new Date(),
            });
          }
        }
      }
    }

    return {
      category: this.category,
      facts,
    };
  }
}
