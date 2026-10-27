import type { DomainPack } from "../../domain/DomainPack";
import { IntentType } from "./intent/IntentType";
import { gameTools } from "./execution/GameTools";
import { createToolRegistry } from "./registry/ToolRegistrar";
import { registerCapabilities } from "./planning/CapabilityRegistrar";
import { LibraryContextProvider } from "./context/LibraryContextProvider";
import { ReviewContextProvider } from "./context/ReviewContextProvider";
import { CollectionContextProvider } from "./context/CollectionContextProvider";
import entityResolver from "./entity/EntityResolver";
import { normalizeSlang, resolveOrdinals, withPageGame } from "./conversation/FollowUps";
import { lastNamedTitle } from "./conversation/TargetGrounding";
import { followUpOffer } from "./conversation/DirectActions";
import { factsForQuestion } from "./conversation/GameFacts";
import { spellOutShorthand } from "./conversation/Shorthand";
import { preRoute } from "./pipeline/PreRoute";
import { correctPlan } from "./pipeline/PlanCorrections";
import { dropUnstatedStatusChanges, ensureCollectionAdds } from "./pipeline/StatusEvidence";
import { groundPlan } from "./pipeline/PlanGrounding";
import { normalizeStatusIntents, shapePlan } from "./pipeline/PlanShaping";
import { forgetChange, hasUntrackedChanges, rememberChange, snapshotBefore, type LastChange } from "./pipeline/UndoLog";
import { askBeforeRemoving, rememberOfferedAdd, tidyReply } from "./pipeline/GameReplies";
import { CLAIMS_ACTION, CORRECTION, KEEP_MODEL_REPLY, LOOKS_LIKE_QUESTION, NOT_SURE_WHAT_TO_CHANGE, NOT_SURE_WHICH_GAME } from "./pipeline/Patterns";
import aiResponseBuilder from "./response/AIResponseBuilder";
import promptBuilder from "./prompts/PromptBuilder";
import { buildAnswerPrompt } from "./prompts/AnswerPromptBuilder";

const ownedTitles = (context?: { library?: { games: { title: string }[] } }) => context?.library?.games.map((g) => g.title) ?? [];

/** RoninArc's world: a game library, its statuses, reviews, notes, collections and launchers. */
export const gamesPack: DomainPack = {
  id: "games",
  intentTypes: Object.values(IntentType),
  tools: gameTools,

  createToolRegistry,
  registerCapabilities,
  registerContextProviders(registry) {
    registry.register(new LibraryContextProvider());
    registry.register(new ReviewContextProvider());
    registry.register(new CollectionContextProvider());
  },
  resolveEntity: (userId, query, options) => entityResolver.resolveGame(userId, query, options),

  // "add the second one" right after a list of picks names that pick.
  normalizeMessage: (message, lastExchange) => resolveOrdinals(normalizeSlang(message), lastExchange),
  withPageContext: withPageGame,
  preRoute,
  correctPlan(plan, { message, lastReply, requestContext }) {
    let unrequested = correctPlan(plan, message, lastReply).unrequested;
    // No status change without a word for it next to that game; "put A and B in soulslike" adds them.
    const owned = ownedTitles(requestContext);
    unrequested += dropUnstatedStatusChanges(plan, message, owned);
    ensureCollectionAdds(plan, message, owned, requestContext?.library?.collections ?? []);
    return unrequested;
  },
  normalizePlan: normalizeStatusIntents,
  groundPlan(plan, { userId, message, requestContext, lastExchange, session }) {
    const owned = ownedTitles(requestContext);
    return groundPlan(plan, {
      userId,
      message,
      owned,
      lastExchange,
      // "it" = the game the assistant just talked about, before an older session reference
      // ("take it out of the soulslike collection" right after "I kept Dark Souls III").
      currentGame: lastNamedTitle(lastExchange?.assistant ?? "", owned) ?? session.references.currentGame?.displayName ?? null,
      pageGame: requestContext?.page?.gameTitle ?? null,
    });
  },
  shapePlan,
  // "add celeste and mark it completed": the game has to exist before the second step can find it.
  runsFirst: (intentType) => intentType === IntentType.AddGame,

  undo: {
    snapshotBefore,
    remember: (userId, snapshot) => rememberChange(userId, snapshot as LastChange),
    forget: forgetChange,
    hasUntrackedChanges,
  },
  followUpOffer: (userId, plan, message) => followUpOffer(userId, plan.intents as any, message),
  // Removing a game deletes its review and notes too, so it always asks first.
  confirmBeforeRunning: askBeforeRemoving,
  finishReply(userId, requestId, message) {
    const tidied = tidyReply(message);
    rememberOfferedAdd(userId, requestId, tidied);
    return tidied;
  },
  describeResults: (executionResult) => aiResponseBuilder.buildResponse(executionResult),

  prompts: {
    plan: (request, toolContext, capabilities, context) =>
      promptBuilder.build(request, toolContext, capabilities, {
        library: context.library,
        recentExchanges: context.recentExchanges,
        page: context.page,
      }),
    answer: (question, context) => buildAnswerPrompt(question, context.library, context.recentExchanges, context.facts),
  },
  async prepareQuestion(question, context) {
    // Release dates, developers and playtimes from the game database, so the model doesn't guess them.
    const facts = await factsForQuestion(question, ownedTitles(context)).catch(() => undefined);
    return { question: spellOutShorthand(question), context: facts ? { ...context, facts } : context };
  },

  phrases: {
    correction: CORRECTION,
    keepModelReply: KEEP_MODEL_REPLY,
    looksLikeQuestion: LOOKS_LIKE_QUESTION,
    claimsAction: CLAIMS_ACTION,
    actionTalk: /\bI(?: can(?:'?t|not)?| could|'ll| will| would)\b[^.!?]*\b(add|adding|create|make|put|move|mark|rate|organi[sz]e|collection|library)\b[^.!?]*[.!?]?/gi,
    notSureWhatToChange: NOT_SURE_WHAT_TO_CHANGE,
    notSureWhich: NOT_SURE_WHICH_GAME,
    missing: (names) =>
      `${names.map((n) => `"${n}"`).join(" and ")} ${names.length === 1 ? "isn't" : "aren't"} in your library, so I skipped that. Say "add ${names[0]}" first if you want it.`,
    ungrounded: "I wasn't sure which game you meant for part of that, so I left it. Tell me the name and I'll do it.",
    keptReview: "I kept the review you'd already written; say \"change my review to ...\" if you want to replace it.",
    claimsActionReply: "I didn't change anything with that message. Tell me what you'd like done, like \"add Elden Ring to Soulslikes\", and I'll do it.",
    greetings: {
      hello: "Hello! I am your RoninArc AI assistant. How can I help you today?",
      thanks: "You're welcome! Let me know if there's anything else I can do for you.",
      howAreYou:
        "I'm doing great, thank you! Ready to help you manage your library, launch games, rate or review them, or manage your collections. What's on your mind?",
      capabilities:
        "I can help you manage your gaming library. You can ask me to: launch a game (e.g. 'Launch Fallout Shelter'), complete a game, rate or review games, manage collections (create, add/remove games), or connect provider accounts like Epic Games. What would you like to do?",
    },
  },
};

export default gamesPack;
