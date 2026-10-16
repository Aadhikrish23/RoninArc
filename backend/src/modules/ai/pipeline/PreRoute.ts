import { IntentPlan } from "../intent/IntentPlan";
import { IntentType } from "../intent/IntentType";
import { IntentParameterType } from "../intent/IntentParameterType";
import { IntentTargetType } from "../intent/IntentTargetType";
import type { AIClientCapabilities } from "../sdk/AIToolContext";
import type { AIRequestContext } from "../conversation/AIRequestContext";
import type { ConversationSession } from "../conversation/ConversationSession";
import { loadLibrarySnapshot } from "../context/LibrarySnapshot";
import recentExchanges from "../conversation/RecentExchanges";
import pendingConfirmations from "../conversation/PendingConfirmationStore";
import { franchiseMatch, namedTitles } from "../conversation/TargetGrounding";
import { answerDirectly, gameFor, type DirectAnswerContext } from "../conversation/DirectAnswers";
import {
  asksForOpinion,
  isQuestionOnly,
  parseCollectionCommand,
  parseQuickCommand,
  parseReviewEdit,
  pinPronoun,
  recommendationFollowUp,
  saveThatAsNote,
  simpleAddTitle,
  unsupportedReply,
  withPageGame,
} from "../conversation/FollowUps";
import { editReview, runCollectionCommand } from "../conversation/DirectActions";
import { CORRECTION, EXPLICIT_ACTION, LOOKS_LIKE_QUESTION, RECOMMEND_ASK } from "./Patterns";
import { forgetChange, lastChange, lastChangeTouched, undoLastChange } from "./UndoLog";

/** "undo", "undo that", "revert that", "put it back". */
const UNDO_ASK = /\b(undo|revert|reverse that|take (that|it) back|put it back)\b/i;
import { resolvePage } from "./PageContext";
import { ModelGateway } from "./ModelGateway";
import { confirmationResponse, type RuntimeResponse } from "./Replies";

export type PreRouteOutcome =
  | { kind: "reply"; response: RuntimeResponse }
  /** `notice` goes in front of the reply ("Sorry about that. I've undone that. ..."). */
  | { kind: "plan"; plan: IntentPlan; notice?: string; pinned?: string };

interface PreRouteInput {
  userId: string;
  requestId: string;
  message: string;
  client: AIClientCapabilities;
  session: ConversationSession;
  requestContext: AIRequestContext;
  model: ModelGateway;
}

/**
 * Everything before (and instead of) the planner: questions answered from the user's data,
 * commands with no tool, plain commands that need no model -- then the model for the rest.
 * The model can take a minute to answer, so the more that's handled here, the better.
 */
export async function preRoute({ userId, requestId, message, client, session, requestContext, model }: PreRouteInput): Promise<PreRouteOutcome> {
  // The model sees the library and the recent conversation, so it can
  // name games itself ("it", "ds3", "the last game I added").
  requestContext.library = await loadLibrarySnapshot(userId);
  requestContext.recentExchanges = recentExchanges.get(userId);

  // What the user is looking at, for "this game" / "this collection".
  const page = await resolvePage(userId, client);
  requestContext.page = page;

  const owned = requestContext.library.games.map((g) => g.title);
  const direct = directContext(userId, owned, requestContext.library.collections, page, session);
  const reply = (response: RuntimeResponse): PreRouteOutcome => ({ kind: "reply", response });

  // "undo that": put back what the last message changed.
  if (UNDO_ASK.test(message)) {
    const undone = await undoLastChange(userId);
    if (undone) return reply({ success: true, message: undone });
  }

  // "no, i said the witcher not dead cells": undo the change on the wrong game first.
  let notice: string | undefined;
  if (CORRECTION.test(message) && lastChange(userId)) {
    const meant = owned.find((t) => namedTitles(message, [t]).length > 0 && !lastChangeTouched(userId, t));
    if (meant) {
      const undone = await undoLastChange(userId);
      if (!EXPLICIT_ACTION.test(message) && !/\b(done|finished|beat|completed|playing|paused|dropped|rated?)\b/i.test(message)) {
        return reply({ success: true, message: `Sorry about that. ${undone} What should I do for ${meant}?` });
      }
      notice = `Sorry about that. ${undone}`;
    }
  }

  // "change my review on it to: ..." keeps the score and replaces only the text.
  const reviewEdit = parseReviewEdit(message);
  const reviewGame = reviewEdit ? gameFor(reviewEdit.target || message, direct) ?? gameFor(message, direct) : undefined;
  if (reviewEdit && reviewGame) {
    forgetChange(userId);
    return reply(await editReview(userId, reviewGame, reviewEdit.text, reviewEdit.rating));
  }

  // Things there's no tool for yet ("remind me friday...", "nuke my library"): say so, change
  // nothing -- before anything else answers a nearby question ("...elden ring coop" got a co-op list).
  const unsupported = unsupportedReply(message);
  if (unsupported) return reply({ success: true, message: unsupported });

  // "save that as a note on sekiro": the note is the assistant's last answer.
  const saved = saveThatAsNote(message, recentExchanges.get(userId).slice(-1)[0]);
  if (saved) {
    const title = (saved.gameText && (namedTitles(saved.gameText, owned)[0] ?? franchiseMatch(saved.gameText, owned))) || direct.currentGame || direct.pageGame;
    if (title && owned.includes(title)) {
      return plan(requestId, { type: IntentType.AddNote, targets: [{ type: IntentTargetType.Game, name: title }], parameters: [{ type: IntentParameterType.Text, value: saved.text }] });
    }
  }

  // "what's in cozy nights?", "read me my notes": answered from the data, never guessed.
  const answered = await answerDirectly(message, direct);
  if (answered.answer) return reply({ success: true, message: answered.answer });
  // "how long does it take to beat? and is it on steam deck": the data answers the first part,
  // the model the rest.
  if (answered.partial && isQuestionOnly(message)) {
    const about = page.gameTitle ?? direct.currentGame;
    const rest = answered.partial.rest.map((q) => (about ? q.replace(/\b(this one|this game|this|it)\b/i, about) : q)).join(". ");
    const general = await model.answerSafely(rest, requestContext).catch(() => "");
    return reply({ success: true, message: [...answered.partial.answers, general.trim()].filter(Boolean).join("\n\n") });
  }

  // "is this one worth it?" on Outer Wilds' page: an opinion about Outer Wilds, not a library readout.
  if (asksForOpinion(message)) {
    const opinion = await model.answerSafely(withPageGame(message, page.gameTitle), requestContext).catch(() => "");
    if (opinion) return reply({ success: true, message: opinion.trim() });
  }


  // "delete that collection", "rename soulslikes to hard games".
  const collectionCommand = parseCollectionCommand(message, requestContext.library.collections, recentExchanges.get(userId), page.collectionName);
  if (collectionCommand) {
    forgetChange(userId);
    const result = await runCollectionCommand(userId, collectionCommand, requestContext.library.collections);
    if (result.kind === "reply") return reply({ success: result.success, message: result.message });
    pendingConfirmations.put(userId, { run: result.run, label: result.label });
    return reply(confirmationResponse(requestId, message, result.question, "Yes, delete it"));
  }

  // "nah, something shorter" right after picks refines that ask;
  // "any roguelikes like hades?" is a recommendation -- no need to ask the planner.
  const followUp = recommendationFollowUp(message, recentExchanges.get(userId).slice(-1)[0]);
  if (followUp || (RECOMMEND_ASK.test(message) && !EXPLICIT_ACTION.test(message))) {
    return plan(requestId, { type: IntentType.RecommendGame, targets: [], parameters: [{ type: IntentParameterType.Text, value: followUp ?? message }] });
  }

  // "rate hollow knight 9 it was amazing", "pause rdr2", "note for rdr2: ...": no planner needed.
  const quick = quickIntent(message, owned, direct.pageGame ?? direct.currentGame ?? undefined);
  if (quick) return { ...plan(requestId, quick), notice } as PreRouteOutcome;

  // "add gta 5": nothing for the planner to work out.
  const addTitle = simpleAddTitle(message);
  if (addTitle) {
    return plan(requestId, { type: IntentType.AddGame, targets: [{ type: IntentTargetType.Library, name: addTitle }], parameters: [] });
  }

  try {
    // "put it in the soulslike one too, and start playing sekiro": "it" is the conversation's game.
    const referent = direct.currentGame ?? direct.pageGame ?? undefined;
    const pinned = pinPronoun(message, referent, (clause) => namedTitles(clause, owned)[0] ?? franchiseMatch(clause, owned));
    return { kind: "plan", plan: await model.planWithRetry(pinned, requestContext), notice, pinned: pinned !== message ? pinned : undefined };
  } catch (error: any) {
    // The planner couldn't produce a plan; a question still deserves an answer.
    if (error?.code === "PROVIDER_VALIDATION_ERROR" && LOOKS_LIKE_QUESTION.test(message)) {
      const answer = await model.answerSafely(message, requestContext).catch(() => "");
      if (answer) return reply({ success: true, message: answer });
    }
    throw error;
  }
}

const plan = (requestId: string, intent: object): PreRouteOutcome => ({
  kind: "plan",
  plan: { id: requestId, requestId, intents: [intent as any] },
});

/** Who "it" and "this" are, and what the user owns, for answers from the data. */
function directContext(
  userId: string,
  owned: string[],
  collections: string[],
  page: { gameTitle?: string; collectionName?: string },
  session: ConversationSession,
): DirectAnswerContext {
  const current = session.references.currentGame?.displayName ?? null;
  return {
    userId,
    collections,
    owned,
    pageGame: page.gameTitle,
    pageCollection: page.collectionName,
    // "it" = the game the conversation is on; failing that, the last game the assistant named.
    currentGame:
      (current && owned.includes(current) ? current : null) ??
      recentExchanges
        .get(userId)
        .slice()
        .reverse()
        .map((e) => namedTitles(e.assistant, owned)[0])
        .find(Boolean) ??
      null,
  };
}

/**
 * A plain single command about an owned game as an intent, or undefined (the planner handles it).
 * Games not in the library go to the planner too, which adds them first.
 */
function quickIntent(message: string, owned: string[], referent?: string): object | undefined {
  const command = parseQuickCommand(message);
  if (!command) return undefined;
  const pointsBack = /^(it|that one|this one|this|that|this game|that game)$/i.test(command.game);
  const title = pointsBack ? referent : namedTitles(command.game, owned)[0] ?? franchiseMatch(command.game, owned);
  if (!title || !owned.includes(title)) return undefined;
  const targets = [{ type: IntentTargetType.Game, name: title }];
  if (command.kind === "rate") {
    return {
      type: IntentType.RateGame,
      targets,
      parameters: [
        { type: IntentParameterType.Rating, value: command.rating },
        ...(command.comment ? [{ type: IntentParameterType.Text, value: command.comment }] : []),
      ],
    };
  }
  if (command.kind === "status") {
    return { type: IntentType.SetStatus, targets, parameters: [{ type: IntentParameterType.Status, value: command.status }] };
  }
  return { type: IntentType.AddNote, targets, parameters: [{ type: IntentParameterType.Text, value: command.text }] };
}
