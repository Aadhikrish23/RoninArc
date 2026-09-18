import type { SteamAuthStrategy, SteamAuthenticationResult } from "./SteamAuthStrategy";
import providerApi from "../../api/providerApi";
import { API_BASE_URL } from "../../../../shared/api/config";

const BACKEND_ORIGIN = new URL(API_BASE_URL).origin;

/**
 * Browser strategy for "Sign in through Steam".
 *
 * Unlike Epic (whose redirect target is locked to Epic's own domain, forcing
 * a manual copy-paste fallback -- see BrowserEpicStrategy), Steam's OpenID
 * return_to/realm are ours to choose. The backend points them at its own
 * relay route (GET /provider/steam/oauth/return), which is same-origin-safe
 * for a popup: it posts the raw redirect params back via window.postMessage
 * and closes itself, so this strategy just listens for that message --
 * no cross-origin polling, no manual fallback needed.
 */
export class BrowserSteamStrategy implements SteamAuthStrategy {
  async authenticate(): Promise<SteamAuthenticationResult> {
    let loginUrl: string;
    try {
      loginUrl = await providerApi.getOAuthUrl("steam");
    } catch {
      return { success: false, error: "Failed to fetch Steam login URL. Please check your connection." };
    }

    const popup = window.open(loginUrl, "SteamLogin", "width=560,height=700,left=200,top=100");
    if (!popup) {
      return { success: false, error: "Your browser blocked the Steam sign-in popup. Please allow popups and try again." };
    }

    return new Promise<SteamAuthenticationResult>((resolve) => {
      const POLL_INTERVAL = 500;
      const TIMEOUT_MS = 5 * 60 * 1000;
      const started = Date.now();
      let settled = false;

      const settle = (result: SteamAuthenticationResult) => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        window.removeEventListener("message", onMessage);
        if (!popup.closed) popup.close();
        resolve(result);
      };

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== BACKEND_ORIGIN) return;
        const data = event.data;
        if (!data || data.source !== "roninarc-provider-oauth" || data.providerId !== "steam") return;
        if (typeof data.params !== "string" || !data.params) {
          settle({ success: false, error: "Steam sign-in response was missing expected data." });
          return;
        }
        settle({ success: true, openIdParams: data.params });
      };

      window.addEventListener("message", onMessage);

      const timer = setInterval(() => {
        if (Date.now() - started > TIMEOUT_MS) {
          settle({ success: false, error: "Steam sign-in timed out after 5 minutes." });
          return;
        }
        if (popup.closed) {
          settle({ success: false, cancelled: true });
        }
      }, POLL_INTERVAL);
    });
  }
}
