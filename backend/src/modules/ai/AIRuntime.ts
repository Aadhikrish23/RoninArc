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
import pendingConfirmations, { isCancelReply, isConfirmReply, yesAndMore } from "./conversation/PendingConfirmationStore";
import { loadLibrarySnapshot } from "./context/LibrarySnapshot";
import recentExchanges from "./conversation/RecentExchanges";
import conversationManager from "./conversation/ConversationManager";
import { Types } from "mongoose";
import LibraryGame from "../library/LibraryGame";
import CollectionModel from "../collection/CollectionModel";
import { READ_ONLY, dropUngroundedIntents, franchiseMatch, mentions, namedTitles, sameGame } from "./conversation/TargetGrounding";
import { titleMatchScore } from "../rawg/titleMatch";
import { answerDirectly, gameFor } from "./conversation/DirectAnswers";
import { asksForOpinion, asksToReadNotes, collectionDirection, isQuestionOnly, meansDroppedStatus, normalizeSlang, parseCollectionCommand, parseReviewEdit, recommendationFollowUp, parseQuickCommand, resolveOrdinals, simpleAddTitle, statedScore, unsupportedReply, wasAskedFor, withPageGame } from "./conversation/FollowUps";
import { editReview, existingReviewText, followUpOffer, runCollectionCommand, writtenFor } from "./conversation/DirectActions";

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
const RECOMMEND_ASK = /\b(recommend|suggest|similar to|something like|anything like|games? like|what should i play|what to play)\b|\b(something|anything|a game)\b[^?.!]*\bweekend\b/i;
const EXPLICIT_ACTION = /\b(add|put|mark|set|remove|delete|rate|note|pause|drop|launch|yeet|move|take)\b/i;
/** An answer-mode reply saying it changed something ("I've added X", "I marked it ...") -- it can't have. */
const CLAIMS_ACTION =
  /\bI(?:'ve| have)?\s+(?:just\s+|now\s+|also\s+)?(?:added|removed|marked|rated|created|deleted|updated|included|put|moved|set|changed|renamed|dropped|paused)\b/i;

/** The model offering an add in its own words: "I can add Silksong to your library ..." */
const OFFER_ADD = /\bI can (?:add|put) ("?[^".?!]{2,60}?"?) (?:to|in|into) your (?:library|backlog)\b/i;

/** Words that ask for the review text itself to change, not just the score. */
const REWRITES_REVIEW = /\breview\b|\b(change|update|edit|replace|rewrite)\b[^.?!]*\b(comment|text|what i wrote)\b/i;

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

      const toolContext: AIToolContext = {
        userId,
        requestId,
        client,
        clientActions: [],
      };

      const finish = (response: RuntimeResponse) => {
        profiler.stopOverall();
        const final = { ...response, message: tidyReply(response.message), metrics: profiler.getMetrics() };
        recentExchanges.add(userId, cleanRequest, final.message || "");
        // "I can add Silksong to your library if you like" -- make "ok" work.
        const offered = typeof final.message === "string" ? final.message.match(OFFER_ADD) : null;
        if (offered && !pendingConfirmations.has(userId)) {
          const title = offered[1].replace(/^"|"$/g, "").trim();
          pendingConfirmations.put(userId, {
            plan: { id: requestId, requestId, intents: [{ type: IntentType.AddGame, targets: [{ type: IntentTargetType.Library, name: title }], parameters: [] } as any] },
            label: title,
            cancelMessage: `Okay, I won't add ${title}.`,
          });
        }
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
        let unrequested = 0;
        const keptReviews: string[] = [];

        // A removal we asked about last turn: "yes" runs it, "no" drops it,
        // anything else drops it and is handled as a new request.
        const pending = pendingConfirmations.take(userId);
        if (pending) {
          const rest = pending.run ? yesAndMore(cleanRequest) : undefined;
          if (isConfirmReply(cleanRequest) && pending.run) {
            return finish({ success: true, message: await pending.run() });
          } else if (rest && pending.run) {
            // "yeah do it, and hollow knight too": do what we offered, then the rest of the message.
            const done = await pending.run();
            const more: RuntimeResponse = await this.chat(userId, pending.collection ? intoCollection(rest, pending.collection) : rest, `${requestId}-more`, client);
            return finish({ ...more, message: `${done} ${more.message}`.trim() });
          } else if (isConfirmReply(cleanRequest) && pending.plan) {
            intentPlan = pending.plan;
            confirmed = true;
          } else if (isCancelReply(cleanRequest)) {
            return finish({
              success: true,
              status: "CANCELLED",
              message: pending.cancelMessage ?? (pending.run ? `Okay, I kept ${pending.label}.` : `Okay, I kept ${pending.label} in your library.`),
            });
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

          // What the user is looking at, for "this game" / "this collection".
          const page = await resolvePage(userId, client);
          requestContext.page = page;

          // "what's in cozy nights?", "read me my notes": answered from the data, never guessed.
          const ownedNow = requestContext.library.games.map((g) => g.title);
          const currentNow = session.references.currentGame?.displayName ?? null;
          const directContext = {
            userId,
            collections: requestContext.library.collections,
            owned: ownedNow,
            pageGame: page.gameTitle,
            pageCollection: page.collectionName,
            // "it" = the game the conversation is on; failing that, the last game the assistant named.
            currentGame:
              (currentNow && ownedNow.includes(currentNow) ? currentNow : null) ??
              recentExchanges
                .get(userId)
                .slice()
                .reverse()
                .map((e) => namedTitles(e.assistant, ownedNow)[0])
                .find(Boolean) ??
              null,
          };
          // "change my review on it to: ..." keeps the score and replaces only the text.
          const reviewEdit = parseReviewEdit(cleanRequest);
          const reviewGame = reviewEdit ? gameFor(reviewEdit.target || cleanRequest, directContext) ?? gameFor(cleanRequest, directContext) : undefined;
          if (reviewEdit && reviewGame) {
            return finish(await editReview(userId, reviewGame, reviewEdit.text, reviewEdit.rating));
          }

          const direct = await answerDirectly(cleanRequest, directContext);
          if (direct.answer) return finish({ success: true, message: direct.answer });
          // "how long does it take to beat? and is it on steam deck": the data answers the first part,
          // the model the rest.
          if (direct.partial && isQuestionOnly(cleanRequest)) {
            const about = page.gameTitle ?? directContext.currentGame;
            const rest = direct.partial.rest.map((q) => (about ? q.replace(/\b(this one|this game|this|it)\b/i, about) : q)).join(". ");
            const general = await this.answerSafely(rest, requestContext).catch(() => "");
            return finish({ success: true, message: [...direct.partial.answers, general.trim()].filter(Boolean).join("\n\n") });
          }

          // "is this one worth it?" on Outer Wilds' page: an opinion about Outer Wilds, not a library readout.
          if (asksForOpinion(cleanRequest)) {
            const opinion = await this.answerSafely(withPageGame(cleanRequest, page.gameTitle), requestContext).catch(() => "");
            if (opinion) return finish({ success: true, message: opinion.trim() });
          }

          // Things there's no tool for yet ("remind me friday...", "undo"): say so, change nothing.
          const unsupported = unsupportedReply(cleanRequest);
          if (unsupported) return finish({ success: true, message: unsupported });

          // "delete that collection", "rename soulslikes to hard games".
          const collectionCommand = parseCollectionCommand(cleanRequest, requestContext.library.collections, recentExchanges.get(userId), page.collectionName);
          if (collectionCommand) {
            const result = await runCollectionCommand(userId, collectionCommand, requestContext.library.collections);
            if (result.kind === "reply") return finish({ success: result.success, message: result.message });
            pendingConfirmations.put(userId, { run: result.run, label: result.label });
            const options = [
              { id: "confirm-yes", label: "Yes, delete it" },
              { id: "confirm-no", label: "No, keep it" },
            ];
            return finish({
              success: false,
              status: "CONFIRMATION_REQUIRED",
              message: result.question,
              clarificationRequest: {
                id: requestId,
                requestId,
                type: "CONFIRMATION",
                question: result.question,
                reason: "This can't be undone.",
                entityType: "confirmation",
                originalQuery: cleanRequest,
                candidates: options,
                options,
                allowFreeText: false,
              },
            });
          }

          // "nah, something shorter" right after picks refines that ask.
          const followUp = recommendationFollowUp(cleanRequest, recentExchanges.get(userId).slice(-1)[0]);
          if (followUp || (RECOMMEND_ASK.test(cleanRequest) && !EXPLICIT_ACTION.test(cleanRequest))) {
            // "any roguelikes like hades?" -- a recommendation; no need to ask the planner.
            intentPlan = {
              id: requestId,
              requestId,
              intents: [{ type: IntentType.RecommendGame, targets: [], parameters: [{ type: IntentParameterType.Text, value: followUp ?? cleanRequest }] } as any],
            };
          } else if (quickPlan(cleanRequest, requestId, ownedNow, directContext.pageGame ?? directContext.currentGame ?? undefined)) {
            // "rate hollow knight 9 it was amazing", "pause rdr2", "note for rdr2: ...": no planner needed.
            intentPlan = quickPlan(cleanRequest, requestId, ownedNow, directContext.pageGame ?? directContext.currentGame ?? undefined)!;
          } else if (simpleAddTitle(cleanRequest)) {
            // "add gta 5": nothing for the planner to work out.
            intentPlan = {
              id: requestId,
              requestId,
              intents: [{ type: IntentType.AddGame, targets: [{ type: IntentTargetType.Library, name: simpleAddTitle(cleanRequest)! }], parameters: [] } as any],
            };
          } else {
            try {
              intentPlan = await this.planWithRetry(cleanRequest, requestContext);
            } catch (error: any) {
              // The planner couldn't produce a plan; a question still deserves an answer.
              if (error?.code === "PROVIDER_VALIDATION_ERROR" && LOOKS_LIKE_QUESTION.test(cleanRequest)) {
                const answer = await this.answerSafely(cleanRequest, requestContext).catch(() => "");
                if (answer) return finish({ success: true, message: answer });
              }
              throw error;
            }
          }
          fromModel = true;

          // Resolve pronoun references
          intentPlan = conversationRuntime.resolveReferences(intentPlan, session);

          // A question never changes anything ("should i play elden ring or sekiro first?").
          if (isQuestionOnly(cleanRequest)) {
            const reads = intentPlan.intents.filter((intent) => READ_ONLY.has(intent.type));
            intentPlan.intents = reads.length > 0 ? reads : [{ type: IntentType.AskQuestion, targets: [], parameters: [] } as any];
          }

          // "just beat witcher 3, 10/10 masterpiece": the score is a rating too, even if the model only
          // planned the status change.
          const score = statedScore(cleanRequest);
          const ratesAlready = intentPlan.intents.some((i) => i.type === IntentType.RateGame || i.type === IntentType.ReviewGame);
          if (score !== undefined && !ratesAlready) {
            const target = intentPlan.intents
              .flatMap((i) => i.targets ?? [])
              .find((t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library);
            if (target?.name) {
              intentPlan.intents.push({
                type: IntentType.RateGame,
                targets: [{ type: IntentTargetType.Game, name: target.name }],
                parameters: [{ type: IntentParameterType.Rating, value: score }],
              } as any);
            }
          }

          // "drop gta 5 its mid" is the Dropped status, never a removal from the library.
          if (meansDroppedStatus(cleanRequest)) {
            for (const intent of intentPlan.intents) {
              if (intent.type !== IntentType.RemoveGame) continue;
              intent.type = IntentType.SetStatus;
              intent.targets = (intent.targets ?? []).map((t) => ({ ...t, type: IntentTargetType.Game }));
              intent.parameters = [{ type: IntentParameterType.Status, value: "dropped" } as any];
            }
          }

          // "put ds3 in there" adds; "take it out of soulslikes" removes -- whatever the model flagged.
          const direction = collectionDirection(cleanRequest);
          if (direction) {
            for (const intent of intentPlan.intents) {
              if (intent.type !== IntentType.OrganizeCollection) continue;
              const others = (intent.parameters ?? []).filter((p: any) => String(p.type).toLowerCase() !== "boolean");
              intent.parameters = [...others, { type: IntentParameterType.Boolean, value: direction === "add" } as any];
            }
          }

          // Changes the message never asked for: "add a note on that one" planned a status change too,
          // "remind me saturday to try outer wilds" planned a new collection.
          const before = intentPlan.intents.length;
          intentPlan.intents = intentPlan.intents.filter((intent) => wasAskedFor(intent.type, cleanRequest));
          unrequested = before - intentPlan.intents.length;

          // "read me my notes" is never a note to save.
          if (asksToReadNotes(cleanRequest)) {
            intentPlan.intents = intentPlan.intents.map((intent) =>
              intent.type === IntentType.AddNote
                ? { ...intent, type: IntentType.LibraryQuestion, parameters: [{ type: IntentParameterType.Text, value: cleanRequest }] as any }
                : intent,
            );
          }
        }

        if (intentPlan) normalizeStatusIntents(intentPlan);

        // Only act on games the user named or clearly referred to.
        let ungrounded = 0;
        const skippedMissing: string[] = [];
        if (intentPlan && fromModel) {
          const last = recentExchanges.get(userId).slice(-1)[0];
          const ownedTitles = requestContext?.library?.games.map((g) => g.title) ?? [];
          const current = session.references.currentGame?.displayName ?? null;
          ungrounded = dropUngroundedIntents(intentPlan, {
            message: cleanRequest,
            recentText: last ? `${last.user} ${last.assistant}` : "",
            // "it" can't point at a game that has since been removed.
            currentGame: current && ownedTitles.some((t) => titleMatchScore(current, t) >= 90 || mentions(current, t)) ? current : null,
            owned: ownedTitles,
            pageGame: requestContext?.page?.gameTitle ?? null,
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

          // "rate hollow knight 9 it was amazing" changes the score; it must not replace a review
          // the user wrote by hand. Only "review X: ..." / "change my review to ..." rewrites it.
          if (!REWRITES_REVIEW.test(cleanRequest)) {
            for (const intent of intentPlan.intents) {
              if (intent.type !== IntentType.RateGame && intent.type !== IntentType.ReviewGame) continue;
              const comment = (intent.parameters ?? []).find((p) => p.type === IntentParameterType.Text);
              const title = intent.targets?.find((t) => t.type === IntentTargetType.Game || t.type === IntentTargetType.Library)?.name;
              if (!comment || !title) continue;
              const existing = await existingReviewText(userId, title);
              if (existing && existing.trim() !== String(comment.value).trim()) {
                intent.parameters = (intent.parameters ?? []).filter((p) => p !== comment);
                keptReviews.push(title);
              }
            }
          }

          // "finished X" for a game already owned: no need to re-add it before changing its status.
          const owned = requestContext?.library?.games.map((g) => g.title) ?? [];
          // Games being added in this same message count as owned for the steps after.
          const adding = intentPlan.intents
            .filter((i) => i.type === IntentType.AddGame)
            .map((i) => i.targets?.[0]?.name ?? "")
            .filter(Boolean);
          const isOwned = (name: string) =>
            [...owned, ...adding].some((t) => sameGame(name, t));

          // "I'm playing sekiro" / "rate celeste 9" for a game not in the library yet: add it first.
          // Anything else aimed at a missing game is skipped with a note, so the rest still runs.
          if (owned.length > 0 || requestContext?.library) {
            const next: typeof intentPlan.intents = [];
            for (const intent of intentPlan.intents) {
              const missing = (intent.targets ?? []).filter((t) => t.type === IntentTargetType.Game && t.name && !isOwned(t.name));
              if (missing.length === 0 || intent.type === IntentType.AddGame) {
                next.push(intent);
              } else if (AUTO_ADD_FOR.has(intent.type) || isCollectionAdd(intent)) {
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
            const ownedAlready = owned.some((t) => sameGame(name, t));
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
            generalAnswer = (await this.answerSafely(withPageGame(cleanRequest, requestContext.page?.gameTitle), requestContext)) || modelReply;
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
        // Everything planned was something the message didn't ask for: change nothing.
        if (actionable.length === 0 && unrequested > 0 && ungrounded === 0 && skippedMissing.length === 0) {
          return finish({ success: true, status: "CLARIFICATION_REQUIRED", message: "I'm not sure what you'd like me to change, so I left everything as it is. Could you say it another way?" });
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

        const outcome = decorate(await this.runPlanned(plan, session, cleanRequest, toolContext, memoryContext, profiler, confirmed));
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

  /** "Clear" in the chat: drop the remembered exchanges, pending confirmation and references. */
  async reset(userId: string) {
    recentExchanges.clear(userId);
    pendingConfirmations.take(userId);
    const session = await conversationManager.getOrCreateSession(userId);
    session.references = { ...session.references, currentGame: null, currentCollection: null, currentProvider: null, lastEntity: null };
    await conversationManager.saveSession(session);
  }

  /**
   * Answer mode can't change anything, but the model once replied "I've added Elden Ring ... and
   * included it in the Soulslikes collection" when nothing ran. A reply claiming an action is replaced.
   */
  private async answerSafely(question: string, context: any): Promise<string> {
    const answer = await this.provider.answer(question, context);
    if (CLAIMS_ACTION.test(answer)) {
      return "I didn't change anything with that message. Tell me what you'd like done, like \"add Elden Ring to Soulslikes\", and I'll do it.";
    }
    return answer;
  }

  /** The planner occasionally returns malformed JSON; one retry usually fixes it. */
  private async planWithRetry(request: string, context: any): Promise<IntentPlan> {
    try {
      return await this.provider.plan(request, context, this.capabilityRegistry.list());
    } catch (error: any) {
      if (error?.code !== "PROVIDER_VALIDATION_ERROR") throw error;
      // At temperature 0 the same prompt gives the same broken reply, so the retry leaves out
      // the recent conversation (the model once looped on its own earlier replies).
      return this.provider.plan(request, { ...context, recentExchanges: [] }, this.capabilityRegistry.list());
    }
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
        // Only warn about a review or notes that actually exist.
        const written = await writtenFor(userId, titles);
        const question = `Remove ${label} from your library?${written ? ` ${titles.length === 1 ? "Its" : "Their"} ${written} will be deleted too.` : ""}`;
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

/** "put ds3 in soulslikes" for a game not in the library: add it, then put it in. */
function isCollectionAdd(intent: any): boolean {
  if (intent.type !== IntentType.OrganizeCollection) return false;
  const flag = (intent.parameters ?? []).find((p: any) => String(p.type).toLowerCase() === "boolean");
  return !flag || (flag.value !== false && flag.value !== "false");
}

/** Titles for the page the user has open, if it's theirs. */
async function resolvePage(userId: string, client: AIClientCapabilities): Promise<{ gameTitle?: string; collectionName?: string }> {
  const page: { gameTitle?: string; collectionName?: string } = {};
  try {
    const uid = new Types.ObjectId(userId);
    if (client.pageGameId) {
      const id = client.pageGameId;
      const or: any[] = [];
      if (Types.ObjectId.isValid(id) && id.length === 24) or.push({ _id: id });
      if (/^\d+$/.test(id)) or.push({ rawgId: Number(id) });
      const game = or.length ? await LibraryGame.findOne({ userId: uid, $or: or }).select("title").lean() : null;
      if (game) page.gameTitle = (game as any).title;
    }
    if (client.pageCollectionId && Types.ObjectId.isValid(client.pageCollectionId)) {
      const col = await CollectionModel.findOne({ _id: client.pageCollectionId, userId: uid }).select("name").lean();
      if (col) page.collectionName = (col as any).name;
    }
  } catch {
    // page context is a hint; never fail the request over it
  }
  return page;
}

/** "Added X as Plan to Play. I've marked X as Completed." reads as one step: "Added X as Completed." */
function tidyReply(message: string): string {
  if (typeof message !== "string") return message;
  return message.replace(
    /I've added (.+?) to your library as Plan to Play\. I've marked \1 as ([A-Za-z ]+?)\.( Congrats on finishing it!)?/g,
    (_m, title, status, congrats) => `I've added ${title} to your library as ${status}.${congrats ?? ""}`,
  );
}

/**
 * A plain single command about an owned game as an intent plan, or undefined (the planner handles it).
 * Games not in the library go to the planner too, which adds them first.
 */
function quickPlan(message: string, requestId: string, owned: string[], referent?: string): IntentPlan | undefined {
  const command = parseQuickCommand(message);
  if (!command) return undefined;
  const pointsBack = /^(it|that one|this one|this|that|this game|that game)$/i.test(command.game);
  const title = pointsBack ? referent : namedTitles(command.game, owned)[0] ?? franchiseMatch(command.game, owned);
  if (!title || !owned.includes(title)) return undefined;
  const target = [{ type: IntentTargetType.Game, name: title }];
  const intent =
    command.kind === "rate"
      ? {
          type: IntentType.RateGame,
          targets: target,
          parameters: [
            { type: IntentParameterType.Rating, value: command.rating },
            ...(command.comment ? [{ type: IntentParameterType.Text, value: command.comment }] : []),
          ],
        }
      : command.kind === "status"
        ? { type: IntentType.SetStatus, targets: target, parameters: [{ type: IntentParameterType.Status, value: command.status }] }
        : { type: IntentType.AddNote, targets: target, parameters: [{ type: IntentParameterType.Text, value: command.text }] };
  return { id: requestId, requestId, intents: [intent as any] };
}

/** "hollow knight too. also put ds3 in there" after a collection offer -> "put hollow knight in Soulslikes. also put ds3 in there". */
function intoCollection(rest: string, collection: string): string {
  const [first, ...others] = rest.split(/(?<=[.!;])\s+|\s+(?=also\b)/i);
  if (/^(put|add|throw|chuck|toss|move|remove|take|mark|rate|set|pause|drop|delete)\b/i.test(first.trim())) return rest;
  const game = first.replace(/\b(too|as well|also)\b/gi, "").replace(/[.!;,]+$/, "").trim();
  return [`put ${game} in ${collection}.`, ...others].join(" ");
}

export default AIRuntime;
