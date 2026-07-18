export interface ClarificationOption {
  id: string;
  label: string;
  subtitle?: string;
  confidence?: number;
  payload?: Record<string, unknown>;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ClarificationRequest {
  requestId: string;
  type: "DISAMBIGUATION" | "CONFIRMATION" | "MISSING_PARAMETER";
  reason: string;
  entityType: string;
  originalQuery: string;
  candidates: ClarificationOption[];
  id?: string;
  question?: string;
  options?: ClarificationOption[];
  allowFreeText?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ConversationTurn {
  requestId: string;
  timestamp: string;
  userMessage: string;
  assistantResponse: {
    success: boolean;
    message?: string;
    status?: string;
    clarificationRequest?: ClarificationRequest | null;
  };
  intentPlanId?: string | null;
  executionPlanId?: string | null;
  summary?: string | null;
  referencesCreated?: string[] | null;
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  status: "ACTIVE" | "WAITING_FOR_CLARIFICATION" | "COMPLETED" | "EXPIRED";
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  turns: ConversationTurn[];
  references: Record<string, unknown>;
  pendingClarification?: ClarificationRequest | null;
  metadata: Record<string, unknown>;
}

export interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: Date;
  status?: "sending" | "sent" | "error";
  clarificationRequest?: ClarificationRequest | null;
}
