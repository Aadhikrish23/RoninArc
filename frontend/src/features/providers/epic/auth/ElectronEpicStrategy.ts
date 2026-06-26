import type { EpicAuthStrategy, AuthenticationResult } from "./EpicAuthStrategy";
import epicApi from "../api/epicApi";

/**
 * Electron OAuth Strategy for Epic Games.
 *
 * Delegates fully to the Electron main process via the `epicLogin` IPC bridge.
 * The main process opens a child BrowserWindow, monitors all navigation and
 * redirect events, and extracts the authorization code through the most reliable
 * source available (URL param, redirect URL, or JSON response body).
 *
 * This strategy is intentionally thin — it only:
 *   1. Fetches the login URL.
 *   2. Invokes the Electron IPC handler.
 *   3. Maps the result to an AuthenticationResult.
 *
 * All browser-window management, event interception, and code extraction happen
 * in the main process (main.js), which has full Node.js / Electron API access.
 */
export class ElectronEpicStrategy implements EpicAuthStrategy {
  async authenticate(): Promise<AuthenticationResult> {
    if (!window.electronAPI?.epicLogin) {
      return {
        success: false,
        error: "The Electron Epic login bridge is not available. Please restart the application.",
      };
    }

    let loginUrl: string;
    try {
      loginUrl = await epicApi.getOAuthUrl();
    } catch {
      return { success: false, error: "Failed to fetch Epic login URL. Please check your connection." };
    }

    try {
      const result = await window.electronAPI.epicLogin(loginUrl);

      if (result === null) {
        // null from the main process means user cancelled / closed the window
        return { success: false, cancelled: true };
      }

      if (typeof result === "string" && result.startsWith("ERROR:")) {
        return { success: false, error: result.replace("ERROR:", "").trim() };
      }

      if (typeof result === "string" && result.length >= 20) {
        return { success: true, authorizationCode: result };
      }

      return { success: false, error: "Could not extract authorization code from Epic login." };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Electron Epic login failed unexpectedly.",
      };
    }
  }
}
