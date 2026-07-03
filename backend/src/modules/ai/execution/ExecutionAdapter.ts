// TEMP DEBUG ONLY

import { ExecutionPlan } from "./ExecutionPlan";
import toolInputFactory from "./ToolInputFactory";
import aiTraceLogger from "../debug/AITraceLogger";
import { ResolvedIntentPlan } from "../entity/ResolvedIntentPlan";
import { EntityResolutionStatus } from "../entity/EntityResolutionStatus";
import { GameNotFoundError } from "../entity/GameNotFoundError";
import { AmbiguousGameError } from "../entity/AmbiguousGameError";
import { IntentTargetType } from "../intent/IntentTargetType";
import { ResolvedTarget } from "../entity/ResolvedTarget";
import { EntityResolutionResult } from "../entity/EntityResolutionResult";

class ResolvedEntityIndex {
  private readonly index = new Map<string, EntityResolutionResult<unknown>>();

  constructor(resolvedTargets: ResolvedTarget[]) {
    for (const rt of resolvedTargets) {
      const key = `${rt.originalTarget.type}:${rt.originalTarget.name}`;
      this.index.set(key, rt.resolution);
    }
  }

  get(type: string, name: string): EntityResolutionResult<unknown> | null {
    return this.index.get(`${type}:${name}`) || null;
  }
}

export class ExecutionAdapter {
  /**
   * Adapts a modern ExecutionPlan to the legacy AIPlan format expected by ActionExecutor.
   */
  async adapt(executionPlan: ExecutionPlan, resolvedIntentPlan: ResolvedIntentPlan) {
    const trace = aiTraceLogger.current();
    const startTime = Date.now();

    const entityIndex = new ResolvedEntityIndex(resolvedIntentPlan.resolvedTargets);

    try {
      const steps = [];

      for (const step of executionPlan.steps) {
        try {
          const legacyInput = toolInputFactory.createInput(step);

          // Resolve gameId if present in the legacy input object using pre-resolved targets Map lookup
          if (typeof legacyInput.gameId === "string" && legacyInput.gameId !== "") {
            const resolutionResult = entityIndex.get(IntentTargetType.Game, legacyInput.gameId);

            if (resolutionResult) {
              if (resolutionResult.status === EntityResolutionStatus.RESOLVED) {
                const entity = resolutionResult.entity as { _id: { toString(): string } };
                legacyInput.gameId = entity._id.toString();
              } else if (resolutionResult.status === EntityResolutionStatus.AMBIGUOUS) {
                throw new AmbiguousGameError(legacyInput.gameId);
              } else {
                throw new GameNotFoundError(legacyInput.gameId);
              }
            } else {
              throw new GameNotFoundError(legacyInput.gameId);
            }
          }

          // Embed capabilityId temporarily for request-scoped step logging
          steps.push({
            id: step.id,
            tool: step.toolName,
            input: {
              ...legacyInput,
              _capabilityId: step.input.capabilityId,
            },
          });
        } catch (error: any) {
          const contextInfo = {
            stepId: step.id,
            toolName: step.toolName,
            capabilityId: step.input?.capabilityId || "unknown",
            payload: step.input,
          };
          if (trace) {
            trace.log("ExecutionAdapter", "ToolInputFactory Exception Context", contextInfo);
            trace.error("ExecutionAdapter", error);
          }
          throw error;
        }
      }

      const legacyPlan = {
        id: executionPlan.id,
        steps,
      };

      if (trace) {
        const elapsed = Date.now() - startTime;
        trace.log("ExecutionAdapter", "Adapted Legacy AIPlan", legacyPlan, elapsed);
      }

      return legacyPlan;
    } catch (error) {
      if (trace) {
        trace.error("ExecutionAdapter", error);
      }
      throw error;
    }
  }
}

export default new ExecutionAdapter();
