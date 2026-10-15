import { AIExecutor } from "./sdk/AIExecutor";
import { AIProvider } from "./providers/AIProvider";
import { AIToolRegistry } from "./sdk/AIToolRegistry";
import { ContextBuilder } from "./context/ContextBuilder";
import { CapabilityRegistry } from "./planning/CapabilityRegistry";
import aiTraceLogger from "./debug/AITraceLogger";
import type { AIClientCapabilities, AIToolContext } from "./sdk/AIToolContext";
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
import { IntentType } from "./intent/IntentType";
import { IntentParameterType } from "./intent/IntentParameterType";
import { ConversationSession } from "./conversation/ConversationSession";
import pendingConfirmations, { isCancelReply, isConfirmReply } from "./conversation/PendingConfirmationStore";
import { loadLibrarySnapshot } from "./context/LibrarySnapshot";
import recentExchanges from "./conversation/RecentExchanges";

/** Status words the model may use as their own intents; all become SetStatus. */
const STATUS_INTENTS: Partial<Record<string, string>> = {
  [IntentType.StartGame]: "playing",
  [IntentType.PauseGame]: "paused",
  [IntentType.DropGame]: "dropped",
};

type RuntimeResponse = Record<string, any> & { success: boolean; message: string; status?: string };

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
  async chat(userId: string, request: string, requestId: string, client: AIClientCapabilities = { canLaunchGames: false }) {
    const profiler = new RuntimeProfiler();
    profiler.startOverall();

    const cleanRequest = request ? request.trim().replace(/\s+/g, " ") : "";

    return aiTraceLogger.run(requestId, async () => {
      const trace = aiTraceLogger.current();
      if (trace) {
        trace.writeHeader(userId, cleanRequest);
        trace.log("AIRuntime", "Runtime Started", { userId, request: cleanRequest });
      }

      const toolContext: AIToolContext = {
        userId,
        requestId,
        client,
        clientActions: [],
      };

      const finish = (response: RuntimeResponse) => {
        profiler.stopOverall();
        const final = { ...response, metrics: profiler.getMetrics() };
        recentExchanges.add(userId, cleanRequest, final.message || "");
        if (trace) {
          const status = final.status || (final.success ? "SUCCESS" : "FAILED");
          trace.updateStats({ status });
          trace.log("FinalResponse", "Completed", final);
          trace.log("AIRuntime", "Runtime Finished", { status });
          trace.end();
        }
        return final;
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
        let confirmed = false;

        // A removal we asked about last turn: "yes" runs it, "no" drops it,
        // anything else drops it and is handled as a new request.
        const pending = pendingConfirmations.take(userId);
        if (pending) {
          if (isConfirmReply(cleanRequest)) {
            intentPlan = pending.plan;
            confirmed = true;
          } else if (isCancelReply(cleanRequest)) {
            return finish({ success: true, status: "CANCELLED", message: `Okay, I kept ${pending.label} in your library.` });
          }
        }

        // 3. Clarification Runtime: Try to resume clarification if WAITING_FOR_CLARIFICATION
        if (!intentPlan) {
          profiler.startLayer("clarification");
          const resumeResult = await clarificationRuntime.resume(session, cleanRequest, requestId);
          profiler.stopLayer("clarification");

          if (resumeResult.errorResponse) {
            return finish({ ...(resumeResult.errorResponse as any) });
          }

          if (resumeResult.isResumed && resumeResult.intentPlan) {
            intentPlan = resumeResult.intentPlan;
          }
        }

        // Inject memoryContext into AIRequestContext
        if (requestContext) {
          requestContext.memoryContext = memoryContext;
        }

        // A pure greeting needs no model, so it's answered even when the LLM is offline.
        const greetingKind = intentPlan ? null : matchGreeting(cleanRequest);

        // 4. Planning Runtime Step A: Call LLM Provider to plan intent if not resumed
        if (!intentPlan && !greetingKind && requestContext) {
          // The model sees the library and the recent conversation, so it can
          // name games itself ("it", "ds3", "the last game I added").
          requestContext.library = await loadLibrarySnapshot(userId);
          requestContext.recentExchanges = recentExchanges.get(userId);

          intentPlan = await this.provider.plan(
            cleanRequest,
            requestContext,
            this.capabilityRegistry.list(),
          );

          // Resolve pronoun references
          intentPlan = conversationRuntime.resolveReferences(intentPlan, session);
        }

        if (intentPlan) normalizeStatusIntents(intentPlan);

        // Conversation the model handles itself: greetings, help, questions it
        // can answer, and requests the app can't do (it writes the reply).
        const conversational = intentPlan?.intents?.filter((i) => i.type === IntentType.AskQuestion || i.type === IntentType.Help) ?? [];
        const actionable = intentPlan?.intents?.filter((i) => i.type !== IntentType.AskQuestion && i.type !== IntentType.Help) ?? [];

        if (greetingKind || (conversational.length > 0 && actionable.length === 0)) {
          const answer = conversational
            .map((i) => i.parameters?.find((p) => p.type === IntentParameterType.Text)?.value)
            .find((v) => typeof v === "string" && v.trim().length > 0) as string | undefined;
          const replyKind: GreetingKind =
            greetingKind ?? (conversational.some((i) => i.type === IntentType.Help) ? "capabilities" : "hello");
          const message = !greetingKind && answer ? answer.trim() : GREETING_REPLIES[replyKind];
          return finish({ success: true, message });
        }

        const plan: IntentPlan = { ...intentPlan!, intents: actionable };

        // "add celeste and mark it completed": the game has to exist before the
        // second step can find it, so additions run as their own first phase.
        const additions = plan.intents.filter((i) => i.type === IntentType.AddGame);
        const rest = plan.intents.filter((i) => i.type !== IntentType.AddGame);
        if (additions.length > 0 && rest.length > 0) {
          const first = await this.runPlanned({ ...plan, intents: additions }, session, cleanRequest, toolContext, memoryContext, profiler, confirmed);
          if (!first.success) return finish(first);
          const second = await this.runPlanned({ ...plan, intents: rest }, session, cleanRequest, toolContext, memoryContext, profiler, confirmed);
          return finish({
            ...second,
            message: `${first.message} ${second.message}`.trim(),
            ...(toolContext.clientActions?.length ? { clientActions: toolContext.clientActions } : {}),
          });
        }

        return finish(await this.runPlanned(plan, session, cleanRequest, toolContext, memoryContext, profiler, confirmed));
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

  /** Planning, clarification, confirmation and execution for one intent plan. */
  private async runPlanned(
    intentPlan: IntentPlan,
    session: ConversationSession,
    cleanRequest: string,
    toolContext: AIToolContext,
    memoryContext: any,
    profiler: RuntimeProfiler,
    confirmed: boolean,
  ): Promise<RuntimeResponse> {
    const { userId, requestId = "" } = toolContext;

    // 5. Planning Runtime Step B: Resolve capabilities, context, entities, and execute PlanningEngine
    profiler.startLayer("planning");
    const planningResultWrapper = await this.planningRuntime.plan(userId, intentPlan, session, cleanRequest);
    const planningResult = planningResultWrapper.planningResult;
    const resolvedIntentPlan = planningResultWrapper.resolvedIntentPlan;
    profiler.stopLayer("planning");

    if (planningResult.status === PlanningStatus.FAILED) {
      return { success: false, message: planningResult.explanation };
    }

    // 6. Clarification Runtime: Evaluate planning result & handle pause if needed
    profiler.startLayer("clarification");
    const clarificationResult = await clarificationRuntime.evaluate(
      planningResult,
      session,
      intentPlan,
      requestId,
      cleanRequest,
    );
    profiler.stopLayer("clarification");

    if (clarificationResult.pause) {
      return { ...(clarificationResult.response as any) };
    }

    // Removing a game deletes its review and notes too, so it always asks first.
    if (!confirmed) {
      const removals = resolvedIntentPlan.intents.filter((i) => i.type === IntentType.RemoveGame);
      const titles = removals.flatMap((i) =>
        i.resolvedTargets.map((t) => (t.resolution?.entity as any)?.title).filter((title): title is string => !!title),
      );
      if (titles.length > 0) {
        // Re-ask with exact titles so "yes" removes exactly what was named.
        const titleByName = new Map<string, string>();
        for (const removal of removals) {
          for (const rt of removal.resolvedTargets) {
            const title = (rt.resolution?.entity as any)?.title;
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
        const question = `Remove ${label} from your library? ${titles.length === 1 ? "Its" : "Their"} review and notes will be deleted too.`;
        const options = [
          { id: "confirm-yes", label: "Yes, remove it" },
          { id: "confirm-no", label: "No, keep it" },
        ];
        return {
          success: false,
          status: "CONFIRMATION_REQUIRED",
          message: question,
          clarificationRequest: {
            id: requestId,
            requestId,
            type: "CONFIRMATION",
            question,
            reason: "Please confirm",
            entityType: "confirmation",
            originalQuery: cleanRequest,
            candidates: options,
            options,
            allowFreeText: false,
          },
        };
      }
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
      cleanRequest,
    );
    profiler.stopLayer("execution");

    if (executionResult.status === "FAILED") {
      return { success: false, message: executionResult.summary, errors: executionResult.errors };
    }

    // 8. Conversation Runtime: Record success and save references
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
}

/** StartGame / PauseGame / DropGame become SetStatus with the matching status. */
function normalizeStatusIntents(plan: IntentPlan) {
  for (const intent of plan.intents ?? []) {
    const implied = STATUS_INTENTS[intent.type];
    if (!implied) continue;
    intent.type = IntentType.SetStatus;
    intent.parameters = intent.parameters ?? [];
    if (!intent.parameters.some((p) => p.type === IntentParameterType.Status)) {
      intent.parameters.push({ type: IntentParameterType.Status, value: implied } as any);
    }
  }
}

export default AIRuntime;
