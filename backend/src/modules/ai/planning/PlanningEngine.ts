// TEMP DEBUG ONLY

import { ContextSnapshot } from "../context/ContextSnapshot";
import { PlanningResult } from "./PlanningResult";
import { PlanningStatus } from "./PlanningStatus";
import { ResolvedCapability } from "./ResolvedCapability";
import { ExecutionCandidate } from "./ExecutionCandidate";
import { ResolvedIntentPlan } from "../entity/ResolvedIntentPlan";
import aiTraceLogger from "../debug/AITraceLogger";

export class PlanningEngine {
  /**
   * Evaluates resolved capabilities, gathered context snapshot, and resolved intent plan to produce a PlanningResult.
   */
  async plan(
    resolvedCapabilities: ResolvedCapability[],
    contextSnapshot: ContextSnapshot,
    resolvedIntentPlan: ResolvedIntentPlan,
  ): Promise<PlanningResult> {
    const trace = aiTraceLogger.current();
    const startTime = Date.now();

    try {
      if (resolvedCapabilities.length === 0) {
        const failedResult = {
          status: PlanningStatus.FAILED,
          explanation: "No resolved capabilities matched the user's intent.",
          executionCandidates: [],
          missingFacts: [],
          suggestions: ["Try rephrasing your request."],
        };

        if (trace) {
          const elapsed = Date.now() - startTime;
          trace.log("PlanningEngine", "Planning Completed", failedResult, elapsed);
        }

        return failedResult;
      }

      // Check if clarification is required from already-resolved entities
      if (resolvedIntentPlan.clarificationRequests.length > 0) {
        const clarificationRequest = resolvedIntentPlan.clarificationRequests[0];

        const clarificationResult: PlanningResult = {
          status: PlanningStatus.CLARIFICATION_REQUIRED,
          explanation: `Ambiguous entity resolution for: "${clarificationRequest.originalQuery}"`,
          executionCandidates: [],
          missingFacts: [],
          suggestions: ["Please clarify which option you meant."],
          clarificationRequest,
        };

        if (trace) {
          const elapsed = Date.now() - startTime;
          trace.log("PlanningEngine", "Planning Completed (Clarification Required)", clarificationResult, elapsed);
        }

        return clarificationResult;
      }

      const executionCandidates: ExecutionCandidate[] = [];
      const missingFactsSet = new Set<string>();

      for (const resolved of resolvedCapabilities) {
        for (const req of resolved.capability.requirements) {
          if (req.contextCategory) {
            const factsForCategory = contextSnapshot.facts[req.contextCategory];
            if (!factsForCategory || factsForCategory.length === 0) {
              missingFactsSet.add(req.contextCategory);
            }
          }
        }

        executionCandidates.push({
          capability: resolved.capability,
          targets: resolved.intent.targets,
          parameters: resolved.intent.parameters,
        });
      }

      const missingFacts = Array.from(missingFactsSet);

      if (missingFacts.length > 0) {
        const partiallyResolvedResult = {
          status: PlanningStatus.PARTIALLY_RESOLVED,
          explanation: "Some capabilities lack required context categories.",
          executionCandidates,
          missingFacts,
          suggestions: ["Additional information is required."],
        };

        if (trace) {
          const elapsed = Date.now() - startTime;
          trace.log("PlanningEngine", "Planning Completed", partiallyResolvedResult, elapsed);
        }

        return partiallyResolvedResult;
      }

      const readyResult = {
        status: PlanningStatus.READY,
        explanation: "All capability requirements met and ready for execution.",
        executionCandidates,
        missingFacts: [],
        suggestions: ["Ready for execution."],
      };

      if (trace) {
        const elapsed = Date.now() - startTime;
        trace.log("PlanningEngine", "Planning Completed", readyResult, elapsed);
      }

      return readyResult;
    } catch (error) {
      if (trace) {
        trace.error("PlanningEngine", error);
      }
      throw error;
    }
  }
}

export default new PlanningEngine();
