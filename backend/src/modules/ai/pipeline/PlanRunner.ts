import { AIExecutor } from "../sdk/AIExecutor";
import { AIToolRegistry } from "../sdk/AIToolRegistry";
import { ContextBuilder } from "../context/ContextBuilder";
import type { AIToolContext } from "../sdk/AIToolContext";
import { RuntimeProfiler } from "../debug/RuntimeProfiler";
import aiResponseBuilder from "../response/AIResponseBuilder";
import conversationRuntime from "../conversation/ConversationRuntime";
import clarificationRuntime from "../clarification/ClarificationRuntime";
import { PlanningRuntime } from "../planning/PlanningRuntime";
import { PlanningStatus } from "../planning/PlanningStatus";
import { ExecutionRuntime } from "../execution/ExecutionRuntime";
import { IntentPlan } from "../intent/IntentPlan";
import { IntentType } from "../intent/IntentType";
import { ConversationSession } from "../conversation/ConversationSession";
import pendingConfirmations from "../conversation/PendingConfirmationStore";
import { writtenFor } from "../conversation/DirectActions";
import { confirmationResponse, type RuntimeResponse } from "./Replies";
import { NOT_SURE_WHAT_TO_CHANGE } from "./Patterns";

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
      return { success: false, message: internal ? NOT_SURE_WHAT_TO_CHANGE : planningResult.explanation };
    }

    // Evaluate the planning result and pause for a clarifying question if needed.
    profiler.startLayer("clarification");
    const clarificationResult = await clarificationRuntime.evaluate(planningResult, session, intentPlan, requestId, cleanRequest);
    profiler.stopLayer("clarification");

    if (clarificationResult.pause) {
      return { ...(clarificationResult.response as any) };
    }

    // Removing a game deletes its review and notes too, so it always asks first.
    if (!confirmed) {
      const removal = await this.askBeforeRemoving(intentPlan, resolvedIntentPlan, userId, requestId, cleanRequest);
      if (removal) return removal;
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
      message: aiResponseBuilder.buildResponse(executionResult),
      // Work only the app can do (e.g. start a game on this PC); see AIClientAction.
      ...(toolContext.clientActions?.length ? { clientActions: toolContext.clientActions } : {}),
    };
  }

  /** A confirmation card for removals, with the exact titles so "yes" removes exactly what was named. */
  private async askBeforeRemoving(
    intentPlan: IntentPlan,
    resolvedIntentPlan: any,
    userId: string,
    requestId: string,
    cleanRequest: string,
  ): Promise<RuntimeResponse | undefined> {
    const removals = resolvedIntentPlan.intents.filter((i: any) => i.type === IntentType.RemoveGame);
    const titles: string[] = removals.flatMap((i: any) =>
      i.resolvedTargets.map((t: any) => t.resolution?.entity?.title).filter((title: unknown): title is string => !!title),
    );
    if (titles.length === 0) return undefined;

    const titleByName = new Map<string, string>();
    for (const removal of removals) {
      for (const rt of removal.resolvedTargets) {
        const title = rt.resolution?.entity?.title;
        if (title) titleByName.set(rt.originalTarget.name, title);
      }
    }
    const exactPlan: IntentPlan = JSON.parse(JSON.stringify(intentPlan));
    for (const intent of exactPlan.intents) {
      if (intent.type !== IntentType.RemoveGame) continue;
      intent.targets = intent.targets.map((t) => ({ ...t, name: titleByName.get(t.name) ?? t.name }));
    }
    const label = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
    pendingConfirmations.put(userId, { plan: exactPlan, label });
    // Only warn about a review or notes that actually exist.
    const written = await writtenFor(userId, titles);
    const question = `Remove ${label} from your library?${written ? ` ${titles.length === 1 ? "Its" : "Their"} ${written} will be deleted too.` : ""}`;
    // Re-adding a game is easy; what can't come back is what the user wrote about it.
    const reason = written ? `You can add it back later, but the ${written} can't be recovered.` : "You can add it back any time.";
    return confirmationResponse(requestId, cleanRequest, question, "Yes, remove it", reason);
  }
}
