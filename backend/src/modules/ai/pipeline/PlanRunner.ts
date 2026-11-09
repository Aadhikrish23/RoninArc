import { AIExecutor } from "../sdk/AIExecutor";
import { AIToolRegistry } from "../sdk/AIToolRegistry";
import { ContextBuilder } from "../context/ContextBuilder";
import type { AIToolContext } from "../sdk/AIToolContext";
import { RuntimeProfiler } from "../debug/RuntimeProfiler";
import conversationRuntime from "../conversation/ConversationRuntime";
import clarificationRuntime from "../clarification/ClarificationRuntime";
import { PlanningRuntime } from "../planning/PlanningRuntime";
import { PlanningStatus } from "../planning/PlanningStatus";
import { ExecutionRuntime } from "../execution/ExecutionRuntime";
import { IntentPlan } from "../intent/IntentPlan";
import { IntentTargetType } from "../intent/IntentTargetType";
import { ConversationSession } from "../conversation/ConversationSession";
import type { RuntimeResponse } from "./Replies";
import { domainPack } from "../domain/activeDomain";

/** Planning, clarification, confirmation and execution for one intent plan. */
export class PlanRunner {
  private readonly planningRuntime: PlanningRuntime;
  private readonly executionRuntime: ExecutionRuntime;

  constructor(contextBuilder: ContextBuilder, toolRegistry: AIToolRegistry, executor: AIExecutor) {
    this.planningRuntime = new PlanningRuntime(contextBuilder);
    this.executionRuntime = new ExecutionRuntime(toolRegistry, executor);
  }

  async run(
    intentPlan: IntentPlan,
    session: ConversationSession,
    cleanRequest: string,
    toolContext: AIToolContext,
    memoryContext: any,
    profiler: RuntimeProfiler,
    confirmed: boolean,
    /** Set on the two halves of a split plan, so neither splits again. */
    splitting = false,
  ): Promise<RuntimeResponse> {
    const { userId, requestId = "" } = toolContext;

    // Resolve capabilities, context, entities, and execute PlanningEngine.
    profiler.startLayer("planning");
    const planningResultWrapper = await this.planningRuntime.plan(userId, intentPlan, session, cleanRequest);
    const planningResult = planningResultWrapper.planningResult;
    const resolvedIntentPlan = planningResultWrapper.resolvedIntentPlan;
    profiler.stopLayer("planning");

    if (planningResult.status === PlanningStatus.FAILED) {
      // "No resolved capabilities matched the user's intent." is for the trace log, not the user.
      const internal = /no resolved capabilities/i.test(planningResult.explanation ?? "");
      return { success: false, message: internal ? domainPack().phrases.notSureWhatToChange : planningResult.explanation };
    }

    // "add the arkham games, make a batman collection and put them in": one unclear game used to
    // stop the whole request, so not even the collection was made. Do the clear steps now and ask
    // only about the unclear one; the question's pending plan holds just that part, so answering
    // it doesn't run the rest twice.
    if (planningResult.status === PlanningStatus.CLARIFICATION_REQUIRED && !splitting) {
      const unclearNames = new Set(resolvedIntentPlan.clarificationRequests.map((c) => c.originalQuery));
      const isUnclear = (intent: IntentPlan["intents"][number]) =>
        (intent.targets ?? []).some((t) => t.type === IntentTargetType.Game && unclearNames.has(t.name));
      const unclear = intentPlan.intents.filter(isUnclear);
      const clear = intentPlan.intents.filter((i) => !isUnclear(i));
      if (unclear.length > 0 && clear.length > 0) {
        const done = await this.run({ ...intentPlan, intents: clear }, session, cleanRequest, toolContext, memoryContext, profiler, confirmed, true);
        // A removal waiting for a yes, or a failure: nothing ran, so ask about the whole request as before.
        if (done.success && !/CONFIRMATION|CLARIFICATION/.test(done.status ?? "")) {
          const ask = await this.run({ ...intentPlan, intents: unclear }, session, cleanRequest, toolContext, memoryContext, profiler, confirmed, true);
          return {
            ...ask,
            message: `${done.message} ${ask.message}`.trim(),
            ...(toolContext.clientActions?.length ? { clientActions: toolContext.clientActions } : {}),
          };
        }
      }
    }

    // Evaluate the planning result and pause for a clarifying question if needed.
    profiler.startLayer("clarification");
    const clarificationResult = await clarificationRuntime.evaluate(planningResult, session, intentPlan, requestId, cleanRequest);
    profiler.stopLayer("clarification");

    if (clarificationResult.pause) {
      return { ...(clarificationResult.response as any) };
    }

    // Some changes ask first (removing a game deletes its review and notes too).
    if (!confirmed) {
      const card = await domainPack().confirmBeforeRunning(intentPlan, resolvedIntentPlan, { userId, requestId, message: cleanRequest });
      if (card) return card;
    }

    // Build the execution plan, validate, adapt, and execute.
    profiler.startLayer("execution");
    const executionResult = await this.executionRuntime.execute(
      planningResult,
      resolvedIntentPlan,
      userId,
      requestId,
      toolContext,
      session,
      memoryContext,
      cleanRequest,
    );
    profiler.stopLayer("execution");

    if (executionResult.status === "FAILED") {
      return { success: false, message: executionResult.summary, errors: executionResult.errors };
    }

    // Record success and save references.
    profiler.startLayer("conversation");
    const conversationResult = await conversationRuntime.handleSuccess(
      userId,
      session,
      intentPlan,
      resolvedIntentPlan,
      executionResult.executionId,
      requestId,
      cleanRequest,
    );
    profiler.stopLayer("conversation");

    return {
      ...conversationResult,
      success: executionResult.status === "SUCCESS",
      status: executionResult.status,
      message: domainPack().describeResults(executionResult),
      // Work only the app can do (e.g. start a game on this PC); see AIClientAction.
      ...(toolContext.clientActions?.length ? { clientActions: toolContext.clientActions } : {}),
    };
  }

}
