import { AIExecutor } from "./sdk/AIExecutor";
import { AIProvider } from "./providers/AIProvider";
import { AIToolRegistry } from "./sdk/AIToolRegistry";
import { ContextBuilder } from "./context/ContextBuilder";
import { CapabilityRegistry } from "./planning/CapabilityRegistry";
import aiTraceLogger from "./debug/AITraceLogger";
import { RuntimeProfiler } from "./debug/RuntimeProfiler";
import aiResponseBuilder from "./response/AIResponseBuilder";
import { AIRuntimeError } from "./runtime/errors/AIRuntimeError";

import conversationRuntime from "./conversation/ConversationRuntime";
import { matchGreeting, GREETING_REPLIES, GreetingKind } from "./conversation/GreetingMatcher";
import clarificationRuntime from "./clarification/ClarificationRuntime";
import memoryRuntime from "./memory/MemoryRuntime";
import { PlanningRuntime } from "./planning/PlanningRuntime";
import { PlanningStatus } from "./planning/PlanningStatus";
import { ExecutionRuntime } from "./execution/ExecutionRuntime";
import { IntentPlan } from "./intent/IntentPlan";

export class AIRuntime {
  private readonly planningRuntime: PlanningRuntime;
  private readonly executionRuntime: ExecutionRuntime;

  constructor(
    private readonly provider: AIProvider,
    private readonly executor: AIExecutor,
    private readonly toolRegistry: AIToolRegistry,
    private readonly contextBuilder: ContextBuilder,
    private readonly capabilityRegistry: CapabilityRegistry,
  ) {
    this.planningRuntime = new PlanningRuntime(this.contextBuilder);
    this.executionRuntime = new ExecutionRuntime(this.toolRegistry, this.executor);
  }

  /**
   * Orchestrates conversation, memory, planning, clarification, and execution runtimes.
   */
  async chat(userId: string, request: string, requestId: string) {
    const profiler = new RuntimeProfiler();
    profiler.startOverall();

    const cleanRequest = request ? request.trim().replace(/\s+/g, " ") : "";

    return aiTraceLogger.run(requestId, async () => {
      const trace = aiTraceLogger.current();
      if (trace) {
        trace.writeHeader(userId, cleanRequest);
        trace.log("AIRuntime", "Runtime Started", { userId, request: cleanRequest });
      }

      const toolContext = {
        userId,
        requestId,
      };

      try {
        // 1. Conversation Runtime: Load conversation session
        profiler.startLayer("conversation");
        const { session, requestContext } =
          await conversationRuntime.loadOrResume(userId, cleanRequest, requestId);
        profiler.stopLayer("conversation");

        // 2. Memory Runtime: Load Memory Context before planning/clarification
        profiler.startLayer("memory");
        const memoryContext = await memoryRuntime.loadMemoryContext(userId);
        profiler.stopLayer("memory");

        let intentPlan: IntentPlan | null = null;

        // 3. Clarification Runtime: Try to resume clarification if WAITING_FOR_CLARIFICATION
        profiler.startLayer("clarification");
        const resumeResult = await clarificationRuntime.resume(session, cleanRequest, requestId);
        profiler.stopLayer("clarification");

        if (resumeResult.errorResponse) {
          profiler.stopOverall();
          const response = {
            ...resumeResult.errorResponse,
            metrics: profiler.getMetrics(),
          };
          if (trace) {
            trace.updateStats({
              status: response.status || "FAILED",
            });
            trace.log("FinalResponse", "Completed", response);
            trace.log("AIRuntime", "Runtime Finished", { status: response.status || "FAILED" });
            trace.end();
          }
          return response;
        }

        if (resumeResult.isResumed && resumeResult.intentPlan) {
          intentPlan = resumeResult.intentPlan;
        }

        // Inject memoryContext into AIRequestContext
        if (requestContext) {
          requestContext.memoryContext = memoryContext;
        }

        // 4. Planning Runtime Step A: Call LLM Provider to plan intent if not resumed
        if (!intentPlan && requestContext) {
          intentPlan = await this.provider.plan(
            cleanRequest,
            requestContext,
            this.capabilityRegistry.list(),
          );

          // Resolve pronoun references
          intentPlan = conversationRuntime.resolveReferences(intentPlan, session);
        }

        // Intercept general conversation: the whole message is a greeting, or the
        // LLM itself classified the request as AskQuestion/Help.
        const greetingKind = matchGreeting(cleanRequest);
        const llmConversationalIntents = intentPlan?.intents?.filter(i => i.type === "AskQuestion" || i.type === "Help") ?? [];

        if (greetingKind || llmConversationalIntents.length > 0) {
          profiler.stopOverall();
          const replyKind: GreetingKind =
            greetingKind ?? (llmConversationalIntents.some(i => i.type === "Help") ? "capabilities" : "hello");
          const conversationalMessage = GREETING_REPLIES[replyKind];

          const response = {
            success: true,
            message: conversationalMessage,
            metrics: profiler.getMetrics(),
          };

          if (trace) {
            trace.updateStats({
              status: "SUCCESS",
            });
            trace.log("FinalResponse", "Completed", response);
            trace.log("AIRuntime", "Runtime Finished", { status: "SUCCESS" });
            trace.end();
          }
          return response;
        }

        // 5. Planning Runtime Step B: Resolve capabilities, context, entities, and execute PlanningEngine
        profiler.startLayer("planning");
        const planningResultWrapper = await this.planningRuntime.plan(userId, intentPlan!, session, cleanRequest);
        const planningResult = planningResultWrapper.planningResult;
        const resolvedIntentPlan = planningResultWrapper.resolvedIntentPlan;
        profiler.stopLayer("planning");

        // PlanningEngine already computes a specific, user-facing explanation when
        // nothing matched (e.g. "No resolved capabilities matched the user's intent.
        // Try rephrasing your request."). Without this check, that explanation was
        // discarded and execution proceeded anyway with zero candidates, surfacing
        // the far less helpful "Validation failed: Empty execution plan." instead.
        if (planningResult.status === PlanningStatus.FAILED) {
          profiler.stopOverall();
          const response = {
            success: false,
            message: planningResult.explanation,
            metrics: profiler.getMetrics(),
          };
          if (trace) {
            trace.updateStats({
              status: "FAILED",
            });
            trace.log("FinalResponse", "Completed", response);
            trace.log("AIRuntime", "Runtime Finished", { status: "FAILED" });
            trace.end();
          }
          return response;
        }

        // 6. Clarification Runtime: Evaluate planning result & handle pause if needed
        profiler.startLayer("clarification");
        const clarificationResult = await clarificationRuntime.evaluate(
          planningResult,
          session,
          intentPlan!,
          requestId,
          cleanRequest,
        );
        profiler.stopLayer("clarification");

        if (clarificationResult.pause) {
          profiler.stopOverall();
          const response = {
            ...clarificationResult.response,
            metrics: profiler.getMetrics(),
          };
          if (trace) {
            trace.updateStats({
              status: "CLARIFICATION_REQUIRED",
            });
            trace.log("FinalResponse", "Completed", response);
            trace.log("AIRuntime", "Runtime Finished", { status: "CLARIFICATION_REQUIRED" });
            trace.end();
          }
          return response;
        }

        // 7. Execution Runtime: Build execution plan, validate, adapt, and execute
        profiler.startLayer("execution");
        const executionResult = await this.executionRuntime.execute(
          planningResult,
          resolvedIntentPlan,
          userId,
          requestId,
          toolContext,
          session,
          memoryContext,
          cleanRequest
        );
        profiler.stopLayer("execution");

        let response;
        if (executionResult.status === "FAILED") {
          profiler.stopOverall();
          response = {
            success: false,
            message: executionResult.summary,
            errors: executionResult.errors,
            metrics: profiler.getMetrics(),
          };
          if (trace) {
            trace.updateStats({
              status: "FAILED",
            });
            trace.log("FinalResponse", "Completed", response);
            trace.log("AIRuntime", "Runtime Finished", { status: "FAILED" });
            trace.end();
          }
          return response;
        }

        // 8. Conversation Runtime: Record success and save references
        profiler.startLayer("conversation");
        const conversationResult = await conversationRuntime.handleSuccess(
          userId,
          session,
          intentPlan!,
          resolvedIntentPlan,
          executionResult.executionId,
          requestId,
          cleanRequest,
        );
        profiler.stopLayer("conversation");

        // Map raw execution result details into a natural user summary
        const friendlyMessage = aiResponseBuilder.buildResponse(executionResult);
        profiler.stopOverall();
        const isFullSuccess = executionResult.status === "SUCCESS";
        response = {
          ...conversationResult,
          success: isFullSuccess,
          status: executionResult.status,
          message: friendlyMessage,
          metrics: profiler.getMetrics(),
        };

        if (trace) {
          trace.updateStats({
            status: executionResult.status,
          });
          trace.log("FinalResponse", "Completed", response);
          trace.log("AIRuntime", "Runtime Finished", { status: executionResult.status });
          trace.end();
        }

        profiler.stopOverall();
        return response;
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (trace) {
          trace.updateStats({
            status: "FAILED",
          });
          trace.log("FinalResponse", "Completed", { success: false, message: errorMsg });
          trace.log("AIRuntime", "Runtime Failed", { error: errorMsg });
          trace.end();
        }
        profiler.stopOverall();
        
        if (error instanceof AIRuntimeError) {
          throw error;
        }
        throw new AIRuntimeError(errorMsg, "AI_RUNTIME_ERROR", false, {}, error);
      }
    });
  }
}
export default AIRuntime;
