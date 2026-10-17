import { IntentType } from "../intent/IntentType";
import { IntentTargetType } from "../intent/IntentTargetType";
import pendingConfirmations from "../conversation/PendingConfirmationStore";
import { OFFER_ADD } from "./Patterns";

/** What the runtime returns to the controller. */
export type RuntimeResponse = Record<string, any> & { success: boolean; message: string; status?: string };

/** "Added X as Plan to Play. I've marked X as Completed." reads as one step: "Added X as Completed." */
export function tidyReply(message: string): string {
  if (typeof message !== "string") return message;
  return message.replace(
    /I've added (.+?) to your library as Plan to Play\. I've marked \1 as ([A-Za-z ]+?)\.( Congrats on finishing it!)?/g,
    (_m, title, status, congrats) => `I've added ${title} to your library as ${status}.${congrats ?? ""}`,
  );
}

/** "I can add Silksong to your library if you like" -- make "ok" work by remembering the offer. */
export function rememberOfferedAdd(userId: string, requestId: string, message: string) {
  const offered = typeof message === "string" ? message.match(OFFER_ADD) : null;
  if (!offered || pendingConfirmations.has(userId)) return;
  const title = offered[1].replace(/^"|"$/g, "").trim();
  pendingConfirmations.put(userId, {
    plan: { id: requestId, requestId, intents: [{ type: IntentType.AddGame, targets: [{ type: IntentTargetType.Library, name: title }], parameters: [] } as any] },
    label: title,
    cancelMessage: `Okay, I won't add ${title}.`,
  });
}

/** A yes/no card: removing a game, deleting a collection. */
export function confirmationResponse(
  requestId: string,
  originalQuery: string,
  question: string,
  yesLabel: string,
  reason = "This can't be undone.",
): RuntimeResponse {
  const options = [
    { id: "confirm-yes", label: yesLabel },
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
      reason,
      entityType: "confirmation",
      originalQuery,
      candidates: options,
      options,
      allowFreeText: false,
    },
  };
}
