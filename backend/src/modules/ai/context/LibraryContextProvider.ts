import libraryServices from "../../library/libraryServices";
import { ContextProvider } from "./ContextProvider";
import { ContextCategory } from "./ContextCategory";
import { ContextRequest } from "./ContextRequest";
import { ContextResult } from "./ContextResult";
import { ContextFact } from "./ContextFact";
import { IntentTargetType } from "../intent/IntentTargetType";

export class LibraryContextProvider implements ContextProvider {
  readonly category = ContextCategory.Library;

  /**
   * Resolves library facts for game targets defined in request.
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
          facts.push({
            category: this.category,
            value: game,
            confidence: 1.0,
            source: "LibraryDatabase",
            timestamp: new Date(),
          });
        }
      } else {
        facts.push({
          category: this.category,
          value: { title: target.name, existsInLibrary: false },
          confidence: 0.5,
          source: "LibraryDatabase",
          timestamp: new Date(),
        });
      }
    }

    return {
      category: this.category,
      facts,
    };
  }
}
