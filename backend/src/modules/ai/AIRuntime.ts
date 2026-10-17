import { AIExecutor } from "./sdk/AIExecutor";
import { AIProvider } from "./providers/AIProvider";
import { AIToolRegistry } from "./sdk/AIToolRegistry";
import { ContextBuilder } from "./context/ContextBuilder";
import { CapabilityRegistry } from "./planning/CapabilityRegistry";
import aiTraceLogger from "./debug/AITraceLogger";
import type { AIClientCapabilities, AIToolContext } from "./sdk/AIToolContext";
import { RuntimeProfiler } from "./debug/RuntimeProfiler";
import { AIRuntimeError } from "./runtime/errors/AIRuntimeError";

import conversationRuntime from "./conversation/ConversationRuntime";
import { matchGreeting, GREETING_REPLIES, GreetingKind } from "./conversation/GreetingMatcher";
import clarificationRuntime from "./clarification/ClarificationRuntime";
import memoryRuntime from "./memory/MemoryRuntime";
import { IntentPlan } from "./intent/IntentPlan";
import { IntentType } from "./intent/IntentType";
import { IntentParameterType } from "./intent/IntentParameterType";
import pendingConfirmations, { isCancelReply } from "./conversation/PendingConfirmationStore";
import recentExchanges from "./conversation/RecentExchanges";
import conversationManager from "./conversation/ConversationManager";
import { normalizeSlang, resolveOrdinals, withPageGame } from "./conversation/FollowUps";
import { lastNamedTitle } from "./conversation/TargetGrounding";
import { followUpOffer } from "./conversation/DirectActions";

import { CORRECTION, KEEP_MODEL_REPLY, LOOKS_LIKE_QUESTION, NOT_SURE_WHAT_TO_CHANGE, NOT_SURE_WHICH_GAME } from "./pipeline/Patterns";
import { rememberOfferedAdd, tidyReply, type RuntimeResponse } from "./pipeline/Replies";
import { ModelGateway } from "./pipeline/ModelGateway";
import { handlePending } from "./pipeline/PendingStage";
import { preRoute } from "./pipeline/PreRoute";
import { correctPlan } from "./pipeline/PlanCorrections";
import { dropUnstatedStatusChanges, ensureCollectionAdds } from "./pipeline/StatusEvidence";
import { groundPlan, type GroundingResult } from "./pipeline/PlanGrounding";
import { normalizeStatusIntents, shapePlan } from "./pipeline/PlanShaping";
import { PlanRunner } from "./pipeline/PlanRunner";
import { forgetChange, hasUntrackedChanges, rememberChange, snapshotBefore } from "./pipeline/UndoLog";

/**
 * One chat message, start to finish. The stages live in ./pipeline:
 *
 *   pending yes/no  ->  clarification resume  ->  pre-route (data answers, plain commands,
 *   then the model)  ->  corrections (the user's own words)  ->  grounding (real games only)
 *   ->  shaping  ->  answer or run (planning, confirmation, execution).
 */
export class AIRuntime {
  private readonly model: ModelGateway;
  private readonly runner: PlanRunner;

  constructor(
    provider: AIProvider,
    executor: AIExecutor,
    toolRegistry: AIToolRegistry,
    contextBuilder: ContextBuilder,
    capabilityRegistry: CapabilityRegistry,
  ) {
    this.model = new ModelGateway(provider, capabilityRegistry);
    this.runner = new PlanRunner(contextBuilder, toolRegistry, executor);
  }

  async chat(userId: string, request: string, requestId: string, client: AIClientCapabilities = { canLaunchGames: false }): Promise<RuntimeResponse> {
    const profiler = new RuntimeProfiler();
    profiler.startOverall();

    const typed = request ? normalizeSlang(request.trim().replace(/\s+/g, " ")) : "";
    // "add the second one" right after a list of picks names that pick.
    const cleanRequest = resolveOrdinals(typed, recentExchanges.get(userId).slice(-1)[0]);

    return aiTraceLogger.run(requestId, async () => {
      const trace = aiTraceLogger.current();
      if (trace) {
        trace.writeHeader(userId, cleanRequest);
        trace.log("AIRuntime", "Runtime Started", { userId, request: cleanRequest });
      }

      const toolContext: AIToolContext = { userId, requestId, client, clientActions: [] };

      const finish = (response: RuntimeResponse) => {
        profiler.stopOverall();
        const final = { ...response, message: tidyReply(response.message), metrics: profiler.getMetrics() };
        recentExchanges.add(userId, cleanRequest, final.message || "");
        rememberOfferedAdd(userId, requestId, final.message);
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
        profiler.startLayer("conversation");
        const { session, requestContext } = await conversationRuntime.loadOrResume(userId, cleanRequest, requestId);
        profiler.stopLayer("conversation");

        profiler.startLayer("memory");
        const memoryContext = await memoryRuntime.loadMemoryContext(userId);
        profiler.stopLayer("memory");

        let intentPlan: IntentPlan | null = null;
        let confirmed = false;
        let fromModel = false;
        let unrequested = 0;
        let notice: string | undefined;
        let planText = cleanRequest;

        // An offer or removal we asked about last turn.
        const pending = await handlePending(userId, cleanRequest);
        if (pending.kind === "reply") return finish(pending.response);
        if (pending.kind === "more") {
          // "yeah do it, and hollow knight too": did what we offered; the rest is a new message.
          const more: RuntimeResponse = await this.chat(userId, pending.rest, `${requestId}-more`, client);
          return finish({ ...more, message: `${pending.done} ${more.message}`.trim() });
        }
        if (pending.kind === "plan") {
          intentPlan = pending.plan;
          confirmed = true;
        }

        // A bare "no" / "never mind" with nothing pending just means "leave it".
        if (!intentPlan && isCancelReply(cleanRequest) && session.status !== "WAITING_FOR_CLARIFICATION") {
          return finish({ success: true, status: "CANCELLED", message: "Okay, I won't change anything." });
        }

        // The answer to a clarifying question we asked.
        if (!intentPlan) {
          profiler.startLayer("clarification");
          const resumeResult = await clarificationRuntime.resume(session, cleanRequest, requestId);
          profiler.stopLayer("clarification");
          if (resumeResult.errorResponse) return finish({ ...(resumeResult.errorResponse as any) });
          if (resumeResult.isResumed && resumeResult.intentPlan) intentPlan = resumeResult.intentPlan;
        }

        if (requestContext) requestContext.memoryContext = memoryContext;

        // A pure greeting needs no model, so it's answered even when the LLM is offline.
        const greetingKind = intentPlan ? null : matchGreeting(cleanRequest);

        if (!intentPlan && !greetingKind && requestContext) {
          const routed = await preRoute({ userId, requestId, message: cleanRequest, client, session, requestContext, model: this.model });
          if (routed.kind === "reply") return finish(routed.response);
          notice = routed.notice;
          // With "it" pinned to a game ("put Dead Cells in there, and start sekiro"), later checks read that.
          planText = routed.pinned ?? cleanRequest;
          intentPlan = conversationRuntime.resolveReferences(routed.plan, session);
          fromModel = true;
          unrequested = correctPlan(intentPlan, planText, recentExchanges.get(userId).slice(-1)[0]?.assistant ?? "").unrequested;
          // No status change without a word for it next to that game; "put A and B in soulslike" adds them.
          const ownedTitles = requestContext.library?.games.map((g) => g.title) ?? [];
          unrequested += dropUnstatedStatusChanges(intentPlan, planText, ownedTitles);
          ensureCollectionAdds(intentPlan, planText, ownedTitles, requestContext.library?.collections ?? []);
        }

        if (intentPlan) normalizeStatusIntents(intentPlan);

        // Only act on games the user named or clearly referred to.
        let grounding: GroundingResult = { ungrounded: 0, skippedMissing: [], keptReviews: [] };
        if (intentPlan && fromModel) {
          grounding = await groundPlan(intentPlan, {
            userId,
            message: planText,
            owned: requestContext?.library?.games.map((g) => g.title) ?? [],
            lastExchange: recentExchanges.get(userId).slice(-1)[0],
            // "it" = the game the assistant just talked about, before an older session reference
            // ("take it out of the soulslike collection" right after "I kept Dark Souls III").
            currentGame:
              lastNamedTitle(recentExchanges.get(userId).slice(-1)[0]?.assistant ?? "", requestContext?.library?.games.map((g) => g.title) ?? []) ??
              session.references.currentGame?.displayName ??
              null,
            pageGame: requestContext?.page?.gameTitle ?? null,
          });
        }
        const { ungrounded, skippedMissing, keptReviews } = grounding;

        if (intentPlan) shapePlan(intentPlan, cleanRequest, fromModel);

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
            generalAnswer = (await this.model.answerSafely(withPageGame(cleanRequest, requestContext.page?.gameTitle), requestContext)) || modelReply;
          } catch {
            generalAnswer = modelReply;
          }
        }

        if (greetingKind || (conversational.length > 0 && actionable.length === 0)) {
          const replyKind: GreetingKind =
            greetingKind ?? (conversational.some((i) => i.type === IntentType.Help) ? "capabilities" : "hello");
          const message = !greetingKind && generalAnswer ? generalAnswer.trim() : GREETING_REPLIES[replyKind];
          return finish({ success: true, message });
        }

        const missingNote = skippedMissing.length
          ? `${skippedMissing.map((n) => `"${n}"`).join(" and ")} ${skippedMissing.length === 1 ? "isn't" : "aren't"} in your library, so I skipped that. Say "add ${skippedMissing[0]}" first if you want it.`
          : "";
        // Everything planned was something the message didn't ask for: change nothing.
        if (actionable.length === 0 && unrequested > 0 && ungrounded === 0 && skippedMissing.length === 0) {
          return finish({ success: true, status: "CLARIFICATION_REQUIRED", message: NOT_SURE_WHAT_TO_CHANGE });
        }
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
          if (response.success && keptReviews.length > 0) {
            message += " I kept the review you'd already written; say \"change my review to ...\" if you want to replace it.";
          }
          if (notice) message = `${notice} ${message}`;
          else if (response.success && CORRECTION.test(cleanRequest)) message = `Sorry about that. ${message}`;
          // "pause rdr2. also is elden ring hard?" -- answer the question part too.
          if (generalAnswer) message = `${message} ${generalAnswer.trim()}`;
          return { ...response, message };
        };
        const run = (p: IntentPlan) => this.runner.run(p, session, cleanRequest, toolContext, memoryContext, profiler, confirmed);
        // What this plan is about to change, so "undo" / "no, I meant X" can put it back.
        const before = await snapshotBefore(userId, plan).catch(() => undefined);
        const remember = (response: RuntimeResponse) => {
          if (!response.success || response.status?.match(/CONFIRMATION|CLARIFICATION/)) return;
          if (hasUntrackedChanges(plan)) forgetChange(userId);
          else if (before) rememberChange(userId, before);
        };

        // "add celeste and mark it completed": the game has to exist before the
        // second step can find it, so additions run as their own first phase.
        const additions = plan.intents.filter((i) => i.type === IntentType.AddGame);
        const rest = plan.intents.filter((i) => i.type !== IntentType.AddGame);
        if (additions.length > 0 && rest.length > 0) {
          const first = await run({ ...plan, intents: additions });
          if (!first.success) return finish(first);
          const second = await run({ ...plan, intents: rest });
          remember(second);
          return finish(decorate({
            ...second,
            message: `${first.message} ${second.message}`.trim(),
            ...(toolContext.clientActions?.length ? { clientActions: toolContext.clientActions } : {}),
          }));
        }

        const outcome = decorate(await run(plan));
        remember(outcome);
        // "Want me to add DS3 and Elden Ring to it?" / "Want me to mark it Completed?"
        if (outcome.success && !outcome.status?.match(/CONFIRMATION|CLARIFICATION/)) {
          const offer = await followUpOffer(userId, plan.intents as any).catch(() => undefined);
          if (offer) {
            pendingConfirmations.put(userId, { run: offer.run, label: offer.label, collection: offer.collection });
            return finish({ ...outcome, message: `${outcome.message} ${offer.question}` });
          }
        }
        return finish(outcome);
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (trace) {
          trace.updateStats({ status: "FAILED" });
          trace.log("FinalResponse", "Completed", { success: false, message: errorMsg });
          trace.log("AIRuntime", "Runtime Failed", { error: errorMsg });
          trace.end();
        }
        profiler.stopOverall();

        if (error instanceof AIRuntimeError) throw error;
        throw new AIRuntimeError(errorMsg, "AI_RUNTIME_ERROR", false, {}, error);
      }
    });
  }

  /** "Clear" in the chat: drop the remembered exchanges, pending confirmation and references. */
  async reset(userId: string) {
    recentExchanges.clear(userId);
    pendingConfirmations.take(userId);
    const session = await conversationManager.getOrCreateSession(userId);
    session.references = { ...session.references, currentGame: null, currentCollection: null, currentProvider: null, lastEntity: null };
    await conversationManager.saveSession(session);
  }
}

export default AIRuntime;
