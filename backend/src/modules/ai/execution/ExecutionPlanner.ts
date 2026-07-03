// TEMP DEBUG ONLY

import { PlanningResult } from "../planning/PlanningResult";
import { PlanningStatus } from "../planning/PlanningStatus";
import { ExecutionPlan } from "./ExecutionPlan";
import { ExecutionStep } from "./ExecutionStep";
import { ResolvedIntentPlan } from "../entity/ResolvedIntentPlan";
import toolMapper from "./ToolMapper";
import crypto from "crypto";
import aiTraceLogger from "../debug/AITraceLogger";

export class ExecutionPlanner {
  /**
   * Translates a PlanningResult into an abstract deterministic ExecutionPlan.
   */
  plan(planningResult: PlanningResult, resolvedIntentPlan: ResolvedIntentPlan): ExecutionPlan {
    const trace = aiTraceLogger.current();
    const startTime = Date.now();

    try {
      const steps: ExecutionStep[] = [];

      if (planningResult.status === PlanningStatus.CLARIFICATION_REQUIRED) {
        const emptyPlan = {
          id: crypto.randomUUID(),
          steps,
        };

        if (trace) {
          const elapsed = Date.now() - startTime;
          trace.log("ExecutionPlanner", "ExecutionPlan Skipped (Clarification Required)", emptyPlan, elapsed);
        }

        return emptyPlan;
      }

      for (const candidate of planningResult.executionCandidates) {
        const toolName = toolMapper.mapCapabilityToTool(candidate.capability.id);

        steps.push({
          id: crypto.randomUUID(),
          toolName,
          input: {
            targets: candidate.targets,
            parameters: candidate.parameters,
            capabilityId: candidate.capability.id,
          },
        });
      }

      const executionPlan = {
        id: crypto.randomUUID(),
        steps,
      };

      if (trace) {
        const elapsed = Date.now() - startTime;
        trace.log("ExecutionPlanner", "ExecutionPlan Generated", executionPlan, elapsed);
      }

      return executionPlan;
    } catch (error) {
      if (trace) {
        trace.error("ExecutionPlanner", error);
      }
      throw error;
    }
  }
}

export default new ExecutionPlanner();
