// TEMP DEBUG ONLY

import { AIExecutor } from "./sdk/AIExecutor";
import { AIProvider } from "./providers/AIProvider";
import { AIToolRegistry } from "./sdk/AIToolRegistry";
import { ContextBuilder } from "./context/ContextBuilder";
import { CapabilityRegistry } from "./planning/CapabilityRegistry";
import capabilityResolver from "./planning/CapabilityResolver";
import contextRequestBuilder from "./context/ContextRequestBuilder";
import entityResolutionLayer from "./entity/EntityResolutionLayer";
import planningEngine from "./planning/PlanningEngine";
import executionPlanner from "./execution/ExecutionPlanner";
import executionAdapter from "./execution/ExecutionAdapter";
import { PlanningStatus } from "./planning/PlanningStatus";
import aiTraceLogger from "./debug/AITraceLogger";

export class AIService {
  constructor(
    private readonly provider: AIProvider,
    private readonly executor: AIExecutor,
    private readonly toolRegistry: AIToolRegistry,
    private readonly contextBuilder: ContextBuilder,
    private readonly capabilityRegistry: CapabilityRegistry,
  ) {}

  async chat(userId: string, request: string, requestId: string) {
    return aiTraceLogger.run(requestId, async () => {
      const trace = aiTraceLogger.current();
      if (trace) {
        trace.writeHeader(userId, request);
      }

      const context = {
        userId,
        requestId,
      };

      try {
        // 1. Generate IntentPlan using capability list
        const intentPlan = await this.provider.plan(
          request,
          context,
          this.capabilityRegistry.list(),
        );

        // 2. Resolve user intents against system capabilities
        const resolvedCapabilities = capabilityResolver.resolve(intentPlan);

        // 3. Build ContextRequest from resolved capabilities propagating existing requestId
        const contextRequest = contextRequestBuilder.build(
          intentPlan.requestId,
          userId,
          resolvedCapabilities,
        );

        // 4. Build ContextSnapshot
        const contextSnapshot = await this.contextBuilder.build(contextRequest);

        // 5. Run Entity Resolution Layer
        const resolvedIntentPlan = await entityResolutionLayer.resolve(
          intentPlan.requestId,
          userId,
          resolvedCapabilities,
        );

        // 6. Evaluate resolved capabilities and gathered ContextSnapshot with the PlanningEngine
        const planningResult = await planningEngine.plan(
          resolvedCapabilities,
          contextSnapshot,
          resolvedIntentPlan,
        );

        // Handle early clarification requests
        if (planningResult.status === PlanningStatus.CLARIFICATION_REQUIRED) {
          const response = {
            success: false,
            status: "CLARIFICATION_REQUIRED",
            clarificationRequest: planningResult.clarificationRequest,
          };

          if (trace) {
            trace.updateStats({
              status: "CLARIFICATION_REQUIRED",
            });
            trace.log("AIService", "Clarification Required", response);
            trace.end();
          }

          return response;
        }

        // 7. Generate ExecutionPlan from PlanningResult
        const executionPlan = executionPlanner.plan(planningResult, resolvedIntentPlan);

        // 8. Adapt ExecutionPlan to legacy AIPlan format using ExecutionAdapter
        const plan = await executionAdapter.adapt(executionPlan, resolvedIntentPlan);

        // 9. Execute adapted steps using legacy ActionExecutor
        const results = await this.executor.execute(plan, context);
        void results;

        const response = {
          success: true,
          message: "AI Layer Ready",
        };

        if (trace) {
          trace.updateStats({
            status: "SUCCESS",
          });
          trace.log("AIService", "Final Response", response);
          trace.end();
        }

        return response;
      } catch (error) {
        if (trace) {
          trace.updateStats({
            status: "FAILED",
          });
          trace.error("AIService", error);
          trace.end();
        }
        throw error;
      }
    });
  }
}
