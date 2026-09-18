import type { SteamAuthStrategy, SteamAuthenticationResult } from "./SteamAuthStrategy";
import providerApi from "../../api/providerApi";

/**
 * Electron strategy for "Sign in through Steam".
 *
 * Delegates to the main process via the `steamLogin` IPC bridge, which opens
 * a child BrowserWindow, watches for navigation back to our own relay route
 * (GET /provider/steam/oauth/return), and hands back that URL's raw query
 * string -- mirrors ElectronEpicStrategy's approach.
 */
export class ElectronSteamStrategy implements SteamAuthStrategy {
  async authenticate(): Promise<SteamAuthenticationResult> {
    if (!window.electronAPI?.steamLogin) {
      return {
        success: false,
        error: "The Electron Steam login bridge is not available. Please restart the application.",
      };
    }

    let loginUrl: string;
    try {
      loginUrl = await providerApi.getOAuthUrl("steam");
    } catch {
      return { success: false, error: "Failed to fetch Steam login URL. Please check your connection." };
    }

    try {
      const result = await window.electronAPI.steamLogin(loginUrl);

      if (result === null) {
        return { success: false, cancelled: true };
      }

      if (typeof result === "string" && result.startsWith("ERROR:")) {
        return { success: false, error: result.replace("ERROR:", "").trim() };
      }

      if (typeof result === "string" && result.length > 0) {
        return { success: true, openIdParams: result };
      }

      return { success: false, error: "Could not read Steam's sign-in response." };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Electron Steam login failed unexpectedly.",
      };
    }
  }
}
