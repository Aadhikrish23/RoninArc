import { AIRuntimeError } from "./AIRuntimeError";

export const AI_OFFLINE_MESSAGE =
  "The AI assistant is offline right now. Check your internet connection and try again -- everything else in RoninArc keeps working.";

/**
 * The LLM provider could not be reached at all (no network, refused, timed
 * out). Distinct from a bad response so the API can refuse gracefully with a
 * 503 instead of surfacing a raw transport error.
 */
export class AIProviderUnavailableError extends AIRuntimeError {
  constructor(detail: string, cause?: unknown) {
    super(detail, "AI_PROVIDER_UNAVAILABLE", true, {}, cause);
    this.name = "AIProviderUnavailableError";
    this.statusCode = 503;
    this.status = "Error";
  }
}

const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNABORTED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

/** True for axios errors where no response ever came back from the provider. */
export function isUnreachable(error: { code?: string; response?: unknown }): boolean {
  return !error.response && !!error.code && UNREACHABLE_CODES.has(error.code);
}
