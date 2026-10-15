import { IntentPlan } from "../intent/IntentPlan";

interface PendingConfirmation {
  /** The plan to run on "yes" -- or `run`, for actions outside the planner (deleting a collection). */
  plan?: IntentPlan;
  run?: () => Promise<string>;
  /** The collection an offer was about, so "yeah, and hollow knight too" goes into it. */
  collection?: string;
  /** What the question named, e.g. "Red Dead Redemption 2". */
  label: string;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;

/**
 * Destructive requests (removing games) wait here for the user's "yes".
 * One pending action per user; it is consumed by the very next message.
 */
class PendingConfirmationStore {
  private readonly pending = new Map<string, PendingConfirmation>();

  put(userId: string, value: Omit<PendingConfirmation, "expiresAt">) {
    this.pending.set(userId, { ...value, expiresAt: Date.now() + TTL_MS });
  }

  /** Returns and clears the pending action, if it hasn't expired. */
  take(userId: string): PendingConfirmation | null {
    const value = this.pending.get(userId);
    this.pending.delete(userId);
    return value && value.expiresAt > Date.now() ? value : null;
  }
}

const YES = /^(y|yes|yep|yeah|yup|sure|ok|okay|confirm|do it|go ahead|yes,? (please|remove it|do it|delete it)|remove it|delete it)[.!]*$/i;
const NO = /^(n|no|nope|nah|cancel|stop|don'?t|keep it|never ?mind|nvm|forget it|no,? (keep it|cancel|thanks|don'?t))[.!]*$/i;

export const isConfirmReply = (text: string) => YES.test(text.trim());
export const isCancelReply = (text: string) => NO.test(text.trim());

export default new PendingConfirmationStore();

/**
 * "yeah do it, and hollow knight too. also put ds3 in there": a yes to the pending offer
 * plus more. Returns the rest of the message, or undefined when it isn't that shape.
 */
const YES_THEN = /^(?:y|yes|yep|yeah|yup|sure|ok|okay|go ahead|do it)\b[\s,.!]*(?:(?:do it|please|pls|go ahead|sure)\b[\s,.!]*)*/i;
export function yesAndMore(text: string): string | undefined {
  const match = text.trim().match(YES_THEN);
  if (!match || match[0].length === 0) return undefined;
  const rest = text.trim().slice(match[0].length).replace(/^(and|also|plus|then)\b[\s,]*/i, "").trim();
  return rest.split(/\s+/).length >= 2 ? rest : undefined;
}
