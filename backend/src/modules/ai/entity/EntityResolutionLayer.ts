// TEMP DEBUG ONLY

import { ResolvedCapability } from "../planning/ResolvedCapability";
import { ResolvedIntentPlan } from "./ResolvedIntentPlan";
import { ResolvedIntent } from "./ResolvedIntent";
import { ResolvedTarget } from "./ResolvedTarget";
import { ClarificationRequest } from "./ClarificationRequest";
import { ClarificationType } from "./ClarificationType";
import entityResolver from "./EntityResolver";
import { EntityResolutionStatus } from "./EntityResolutionStatus";
import { IntentTargetType } from "../intent/IntentTargetType";
import { LibraryGame } from "./LibraryGame";
import { IntentTarget } from "../intent/IntentTarget";
import aiTraceLogger from "../debug/AITraceLogger";

export class EntityResolutionLayer {
  /**
   * Resolves entity targets in resolved capabilities.
   */
  async resolve(
    requestId: string,
    userId: string,
    resolvedCapabilities: ResolvedCapability[],
  ): Promise<ResolvedIntentPlan> {
    const trace = aiTraceLogger.current();
    const startTime = Date.now();

    const resolvedIntents: ResolvedIntent[] = [];
    const allResolvedTargets: ResolvedTarget[] = [];
    const clarificationRequests: ClarificationRequest[] = [];

    for (const resCap of resolvedCapabilities) {
      const intent = resCap.intent;
      const resolvedTargets: ResolvedTarget[] = [];

      for (const target of intent.targets) {
        if (target.type === IntentTargetType.Game) {
          const resolutionResult = await entityResolver.resolveGame(userId, target.name);

          const resolvedTarget: ResolvedTarget<LibraryGame> = {
            originalTarget: target,
            resolution: resolutionResult,
          };

          resolvedTargets.push(resolvedTarget);
          allResolvedTargets.push(resolvedTarget);

          if (resolutionResult.status === EntityResolutionStatus.AMBIGUOUS) {
            const candidates = (resolutionResult.candidates || []).map((c) => ({
              id: c._id.toString(),
              label: c.title,
              confidence: resolutionResult.confidence,
            }));

            clarificationRequests.push({
              requestId,
              type: ClarificationType.AMBIGUOUS_GAME,
              reason: `Multiple matches found for "${target.name}"`,
              entityType: IntentTargetType.Game,
              originalQuery: target.name,
              candidates,
            });

            if (trace) {
              trace.log("EntityResolutionLayer", "Clarification Requested", {
                requestId,
                originalQuery: target.name,
                candidateCount: candidates.length,
              });
            }
          }
        } else {
          // Non-game targets are bypassed
          const resolutionResult = {
            status: EntityResolutionStatus.RESOLVED,
            confidence: 1.0,
            entity: target,
            reasoning: "Non-game target bypass resolution.",
          };

          const resolvedTarget: ResolvedTarget<IntentTarget> = {
            originalTarget: target,
            resolution: resolutionResult,
          };

          resolvedTargets.push(resolvedTarget);
          allResolvedTargets.push(resolvedTarget);
        }
      }

      resolvedIntents.push({
        type: intent.type,
        confidence: intent.confidence,
        originalTargets: intent.targets,
        resolvedTargets,
        parameters: intent.parameters,
      });
    }

    const resolvedIntentPlan: ResolvedIntentPlan = {
      requestId,
      intents: resolvedIntents,
      resolvedTargets: allResolvedTargets,
      clarificationRequests,
    };

    if (trace) {
      const elapsed = Date.now() - startTime;
      trace.log("EntityResolutionLayer", "Entity Resolution Completed", {
        requestId,
        resolvedTargetsCount: allResolvedTargets.length,
        clarificationRequestsCount: clarificationRequests.length,
      }, elapsed);
    }

    return resolvedIntentPlan;
  }
}

export default new EntityResolutionLayer();
