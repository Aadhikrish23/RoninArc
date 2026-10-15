import { IntentPlan } from "../intent/IntentPlan";

interface PendingConfirmation {
  plan: IntentPlan;
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
