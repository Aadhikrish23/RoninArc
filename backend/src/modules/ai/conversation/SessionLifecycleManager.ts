import { ConversationSession } from "./ConversationSession";
import { ConversationStatus } from "./ConversationStatus";
import crypto from "crypto";

export class SessionLifecycleManager {
  /**
   * Creates a new conversation session.
   */
  createSession(userId: string): ConversationSession {
    return {
      sessionId: crypto.randomUUID(),
      userId,
      status: ConversationStatus.ACTIVE,
      turns: [],
      references: {
        currentGame: null,
        lastEntity: null,
        pendingEntity: null,
        currentCollection: null,
        currentProvider: null,
      },
      pendingClarification: null,
      pendingState: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 1800000), // 30 minutes inactivity timeout
      metadata: {},
    };
  }

  /**
   * Evaluates and returns if a session has expired.
   */
  isExpired(session: ConversationSession, maxInactivityMs: number): boolean {
    const elapsed = Date.now() - new Date(session.updatedAt).getTime();
    return elapsed > maxInactivityMs;
  }

  /**
   * Resets status to active / closed state.
   */
  closeSession(session: ConversationSession): void {
    session.status = ConversationStatus.ACTIVE;
    session.pendingClarification = null;
    session.pendingState = null;
    session.updatedAt = new Date();
  }
}

export default new SessionLifecycleManager();
