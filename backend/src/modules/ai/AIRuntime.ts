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
import { IntentTargetType } from "./intent/IntentTargetType";
import { ConversationSession } from "./conversation/ConversationSession";
import pendingConfirmations, { isCancelReply, isConfirmReply } from "./conversation/PendingConfirmationStore";
import { loadLibrarySnapshot } from "./context/LibrarySnapshot";
import recentExchanges from "./conversation/RecentExchanges";
import { dropUngroundedIntents, mentions } from "./conversation/TargetGrounding";
import { titleMatchScore } from "../rawg/titleMatch";

/** "wait no, I said celeste" -- the reply should own the mistake. */
const CORRECTION = /\b(i said|i meant|wrong (game|one)|didn'?t ask|not that one|wait,? no|that'?s wrong|no,? i)\b/i;

/** A status or rating for a game that isn't in the library means "add it, then do that". */
const AUTO_ADD_FOR = new Set<string>([IntentType.SetStatus, IntentType.CompleteGame, IntentType.RateGame, IntentType.ReviewGame]);

/** Questions about what the user has recorded; anything else is a general gaming question. */
const RECORDED_DATA = /\b(rate|rated|rating|ratings|score|status|finish|finished|complete|completed|beat|beaten|playing|paused|dropped|planned|plan to play|backlog|how many|own|owned|have i|in my (library|list)|added|note|notes|collection|collections|top rated|favou?rites?)\b/i;
const LOOKS_LIKE_QUESTION = /\?\s*$|^(what|whats|what's|how|is|are|should|which|why|does|do|can|could|would|who|when|where|any)\b/i;
/** The model's own short replies that are better than a fresh answer: refusals, "didn't catch that". */
const KEEP_MODEL_REPLY = /\b(can'?t|cannot|didn'?t catch|not sure what|rephrase)\b/i;

/** Intents that act on one game at a time; a multi-game one is split per game. */
const PER_GAME_INTENTS = new Set<string>([
  IntentType.OrganizeCollection, IntentType.SetStatus, IntentType.CompleteGame, IntentType.RateGame,
  IntentType.ReviewGame, IntentType.DeleteReview, IntentType.RemoveGame, IntentType.AddNote, IntentType.AddGame,
]);

/** Asking for suggestions, and the words that mean "do something" instead. */
const RECOMMEND_ASK = /\b(recommend|suggest|similar to|something like|anything like|games? like|what should i play|what to play)\b/i;
const EXPLICIT_ACTION = /\b(add|put|mark|set|remove|delete|rate|note|pause|drop|launch|yeet|move|take)\b/i;

const NOT_SURE_WHICH_GAME =
  "I'm not sure which game you mean, so I didn't change anything. Tell me the game's name and I'll do it.";

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
        let fromModel = false;

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

        // A bare "no" / "never mind" with nothing pending just means "leave it".
        if (!intentPlan && isCancelReply(cleanRequest) && session.status !== "WAITING_FOR_CLARIFICATION") {
          return finish({ success: true, status: "CANCELLED", message: "Okay, I won't change anything." });
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
          fromModel = true;

          // Resolve pronoun references
          intentPlan = conversationRuntime.resolveReferences(intentPlan, session);
        }

        if (intentPlan) normalizeStatusIntents(intentPlan);

        // Only act on games the user named or clearly referred to.
        let ungrounded = 0;
        const skippedMissing: string[] = [];
        if (intentPlan && fromModel) {
          const last = recentExchanges.get(userId).slice(-1)[0];
          ungrounded = dropUngroundedIntents(intentPlan, {
            message: cleanRequest,
            recentText: last ? `${last.user} ${last.assistant}` : "",
            currentGame: session.references.currentGame?.displayName ?? null,
            owned: requestContext?.library?.games.map((g) => g.title) ?? [],
          });

          // A review comment must come from the user's own words, not the prompt's examples
          // (the model once attached "it was amazing" to a plain "rate hollow knight 9").
          const said = new Set(cleanRequest.toLowerCase().match(/[a-z']+/g) ?? []);
          for (const intent of intentPlan.intents) {
            if (intent.type !== IntentType.RateGame && intent.type !== IntentType.ReviewGame) continue;
            intent.parameters = (intent.parameters ?? []).filter((p) => {
              if (p.type !== IntentParameterType.Text || typeof p.value !== "string") return true;
              const words = p.value.toLowerCase().match(/[a-z']+/g) ?? [];
              return words.length > 0 && words.filter((w) => said.has(w)).length / words.length >= 0.6;
            });
          }

          // "finished X" for a game already owned: no need to re-add it before changing its status.
          const owned = requestContext?.library?.games.map((g) => g.title) ?? [];
          const isOwned = (name: string) => owned.some((t) => titleMatchScore(name, t) >= 70 || mentions(name, t));

          // "I'm playing sekiro" / "rate celeste 9" for a game not in the library yet: add it first.
          // Anything else aimed at a missing game is skipped with a note, so the rest still runs.
          if (owned.length > 0 || requestContext?.library) {
            const next: typeof intentPlan.intents = [];
            for (const intent of intentPlan.intents) {
              const missing = (intent.targets ?? []).filter((t) => t.type === IntentTargetType.Game && t.name && !isOwned(t.name));
              if (missing.length === 0 || intent.type === IntentType.AddGame) {
                next.push(intent);
              } else if (AUTO_ADD_FOR.has(intent.type)) {
                for (const m of missing) {
                  const alreadyAdding = next.some((i) => i.type === IntentType.AddGame && i.targets?.some((t) => titleMatchScore(t.name ?? "", m.name) >= 90));
                  if (!alreadyAdding) next.push({ ...intent, type: IntentType.AddGame, targets: [{ type: IntentTargetType.Library, name: m.name }], parameters: [] } as any);
                }
                next.push(intent);
              } else {
                skippedMissing.push(...missing.map((m) => m.name));
              }
            }
            intentPlan.intents = next;
          }
          const changed = intentPlan.intents.filter((i) => i.type !== IntentType.AddGame);
          intentPlan.intents = intentPlan.intents.filter((i) => {
            if (i.type !== IntentType.AddGame || changed.length === 0) return true;
            const name = i.targets?.[0]?.name ?? "";
            const ownedAlready = owned.some((t) => titleMatchScore(name, t) >= 95 || mentions(name, t));
            const touchedLater = changed.some((c) => (c.targets ?? []).some((t) => titleMatchScore(t.name ?? "", name) >= 90 || mentions(t.name ?? "", name)));
            return !(ownedAlready && touchedLater);
          });
        }

        // "any cozy games like stardew" asks for suggestions; the model once turned it into
        // "add Stardew Valley". Without an explicit action word, it's a recommendation.
        if (intentPlan && fromModel && RECOMMEND_ASK.test(cleanRequest) && !EXPLICIT_ACTION.test(cleanRequest)) {
          intentPlan.intents = [
            { type: IntentType.RecommendGame, targets: [], parameters: [{ type: IntentParameterType.Text, value: cleanRequest }] } as any,
          ];
        }

        // New games start as Plan to Play, so "add X" + "set X to plan" is one action, not two.
        if (intentPlan) {
          const added = intentPlan.intents.filter((i) => i.type === IntentType.AddGame).map((i) => i.targets?.[0]?.name ?? "");
          intentPlan.intents = intentPlan.intents.filter((i) => {
            if (i.type !== IntentType.SetStatus) return true;
            const status = String(i.parameters?.find((p) => p.type === IntentParameterType.Status)?.value ?? "").toLowerCase();
            const name = i.targets?.[0]?.name ?? "";
            return !(/^plan/.test(status) && added.some((a) => titleMatchScore(a, name) >= 90 || mentions(a, name)));
          });
        }

        // Recommendations read the user's own words too: the model's hint sometimes drops
        // "roguelike" or "under 20 hours", and those drive the filters.
        if (intentPlan && fromModel) {
          for (const intent of intentPlan.intents) {
            if (intent.type !== IntentType.RecommendGame) continue;
            const params = intent.parameters ?? [];
            const text = params.find((p) => p.type === IntentParameterType.Text);
            const hint = typeof text?.value === "string" ? text.value : "";
            const combined = hint.toLowerCase().includes(cleanRequest.toLowerCase()) ? hint : `${hint} ${cleanRequest}`.trim();
            intent.parameters = [...params.filter((p) => p !== text), { type: IntentParameterType.Text, value: combined } as any];
          }
        }

        // "put elden ring and hollow knight in soulslike": one intent per game, so none is dropped.
        if (intentPlan) {
          intentPlan.intents = intentPlan.intents.flatMap((intent) => {
            if (!PER_GAME_INTENTS.has(intent.type)) return [intent];
            const games = (intent.targets ?? []).filter((t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library);
            if (games.length <= 1) return [intent];
            const others = (intent.targets ?? []).filter((t) => !games.includes(t));
            return games.map((g) => ({ ...intent, targets: [...others, g] }));
          });
        }

        // "is silksong worth it?" sometimes comes back as a library question; it's a
        // general one unless it asks about the user's own records.
        if (intentPlan && fromModel) {
          for (const intent of intentPlan.intents) {
            if (intent.type !== IntentType.LibraryQuestion) continue;
            const text = String(intent.parameters?.find((p) => p.type === IntentParameterType.Text)?.value ?? cleanRequest);
            if (!RECORDED_DATA.test(text)) {
              intent.type = IntentType.AskQuestion;
              intent.parameters = [];
            }
          }
        }

        // Conversation the model handles itself: greetings, help, questions it
        // can answer, and requests the app can't do (it writes the reply).
        const conversational = intentPlan?.intents?.filter((i) => i.type === IntentType.AskQuestion || i.type === IntentType.Help) ?? [];
        const actionable = intentPlan?.intents?.filter((i) => i.type !== IntentType.AskQuestion && i.type !== IntentType.Help) ?? [];

        // A real question gets a real answer from the model (a second, plain-text call);
        // refusals and "didn't catch that" keep the model's short reply.
        const modelReply = conversational
          .map((i) => i.parameters?.find((p) => p.type === IntentParameterType.Text)?.value)
          .find((v) => typeof v === "string" && v.trim().length > 0) as string | undefined;
        const wantsAnswer =
          !greetingKind &&
          conversational.some((i) => i.type === IntentType.AskQuestion) &&
          (!modelReply || (LOOKS_LIKE_QUESTION.test(cleanRequest) && !KEEP_MODEL_REPLY.test(modelReply)));
        let generalAnswer: string | undefined = modelReply;
        if (wantsAnswer && requestContext) {
          try {
            generalAnswer = (await this.provider.answer(cleanRequest, requestContext)) || modelReply;
          } catch {
            generalAnswer = modelReply;
          }
        }

        if (greetingKind || (conversational.length > 0 && actionable.length === 0)) {
          const answer = generalAnswer;
          const replyKind: GreetingKind =
            greetingKind ?? (conversational.some((i) => i.type === IntentType.Help) ? "capabilities" : "hello");
          const message = !greetingKind && answer ? answer.trim() : GREETING_REPLIES[replyKind];
          return finish({ success: true, message });
        }

        const missingNote = skippedMissing.length
          ? `${skippedMissing.map((n) => `"${n}"`).join(" and ")} ${skippedMissing.length === 1 ? "isn't" : "aren't"} in your library, so I skipped that. Say "add ${skippedMissing[0]}" first if you want it.`
          : "";
        if (actionable.length === 0 && (ungrounded > 0 || skippedMissing.length > 0)) {
          return finish({ success: true, status: "CLARIFICATION_REQUIRED", message: missingNote || NOT_SURE_WHICH_GAME });
        }

        const plan: IntentPlan = { ...intentPlan!, intents: actionable };
        const decorate = (response: RuntimeResponse): RuntimeResponse => {
          let message = response.message;
          if (missingNote) message += ` ${missingNote}`;
          if (ungrounded > 0 && response.success) {
            message += " I wasn't sure which game you meant for part of that, so I left it. Tell me the name and I'll do it.";
          }
          if (response.success && CORRECTION.test(cleanRequest)) message = `Sorry about that. ${message}`;
          // "pause rdr2. also is elden ring hard?" -- answer the question part too.
          if (generalAnswer) message = `${message} ${generalAnswer.trim()}`;
          return { ...response, message };
        };

        // "add celeste and mark it completed": the game has to exist before the
        // second step can find it, so additions run as their own first phase.
        const additions = plan.intents.filter((i) => i.type === IntentType.AddGame);
        const rest = plan.intents.filter((i) => i.type !== IntentType.AddGame);
        if (additions.length > 0 && rest.length > 0) {
          const first = await this.runPlanned({ ...plan, intents: additions }, session, cleanRequest, toolContext, memoryContext, profiler, confirmed);
          if (!first.success) return finish(first);
          const second = await this.runPlanned({ ...plan, intents: rest }, session, cleanRequest, toolContext, memoryContext, profiler, confirmed);
          return finish(decorate({
            ...second,
            message: `${first.message} ${second.message}`.trim(),
            ...(toolContext.clientActions?.length ? { clientActions: toolContext.clientActions } : {}),
          }));
        }

        return finish(decorate(await this.runPlanned(plan, session, cleanRequest, toolContext, memoryContext, profiler, confirmed)));
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
            reason: "This can't be undone.",
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
