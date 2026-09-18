/**
 * Shared result model returned by every Steam sign-in strategy.
 * Strategies must never throw for normal control-flow (cancellation, timeout, etc.)
 * -- they should return a structured result instead.
 */
export interface SteamAuthenticationResult {
  /** Whether sign-in completed and a redirect response was captured. */
  success: boolean;
  /**
   * The raw, still-unverified query string Steam appended to our return_to
   * URL (openid.* params). Verification happens once, server-side, inside
   * the authenticated /connect call -- present only when success === true.
   */
  openIdParams?: string;
  /** True when the user explicitly dismissed / cancelled the flow. */
  cancelled?: boolean;
  /** Human-readable description of any error that occurred. */
  error?: string;
}

/**
 * Contract every Steam sign-in strategy must implement.
 *
 * Responsibilities:
 *   - Obtain the raw Steam OpenID redirect response through the appropriate mechanism.
 *
 * Explicitly NOT responsible for:
 *   - Verifying the OpenID assertion
 *   - Calling backend APIs
 *   - Updating application state
 *   - Triggering synchronisation
 */
export interface SteamAuthStrategy {
  authenticate(): Promise<SteamAuthenticationResult>;
}
