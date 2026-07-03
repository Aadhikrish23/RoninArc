import collectionService from "../../collection/collectionService";
import { ContextProvider } from "./ContextProvider";
import { ContextCategory } from "./ContextCategory";
import { ContextRequest } from "./ContextRequest";
import { ContextResult } from "./ContextResult";
import { ContextFact } from "./ContextFact";
import { IntentTargetType } from "../intent/IntentTargetType";

export class CollectionContextProvider implements ContextProvider {
  readonly category = ContextCategory.Collections;

  /**
   * Resolves collection facts for collection targets defined in request.
   */
  async build(request: ContextRequest): Promise<ContextResult> {
    const facts: ContextFact[] = [];

    const collectionTargets = request.targets.filter(
      (t) => t.type === IntentTargetType.Collection,
    );

    if (collectionTargets.length > 0) {
      const collections = await collectionService.getCollections(request.userId);

      for (const target of collectionTargets) {
        const matched = collections.filter(
          (c) => c.name.toLowerCase() === target.name.toLowerCase(),
        );

        for (const collection of matched) {
          facts.push({
            category: this.category,
            value: collection,
            confidence: 1.0,
            source: "CollectionDatabase",
            timestamp: new Date(),
          });
        }
      }
    }

    return {
      category: this.category,
      facts,
    };
  }
}
