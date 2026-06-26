/**
 * Shared result model returned by every authentication strategy.
 * Strategies must never throw for normal control-flow (cancellation, timeout, etc.)
 * — they should return a structured result instead.
 */
export interface AuthenticationResult {
  /** Whether the authentication completed successfully and a code was obtained. */
  success: boolean;
  /** The authorization code, present only when success === true. */
  authorizationCode?: string;
  /** True when the user explicitly dismissed / cancelled the flow. */
  cancelled?: boolean;
  /** Human-readable description of any error that occurred. */
  error?: string;
}

/**
 * Contract that every Epic authentication strategy must implement.
 *
 * Responsibilities:
 *   - Obtain the Epic authorization code through the appropriate mechanism.
 *
 * Explicitly NOT responsible for:
 *   - Calling backend APIs
 *   - Updating application state
 *   - Refreshing provider status
 *   - Triggering synchronisation
 *   - Token exchange
 */
export interface EpicAuthStrategy {
  authenticate(): Promise<AuthenticationResult>;
}
