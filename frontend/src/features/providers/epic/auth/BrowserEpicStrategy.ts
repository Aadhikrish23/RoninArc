import type { EpicAuthStrategy, AuthenticationResult } from "./EpicAuthStrategy";
import epicApi from "../api/epicApi";

/**
 * Browser OAuth Strategy for Epic Games.
 *
 * Primary flow (automatic):
 *   1. Fetch the login URL from the backend.
 *   2. Open a popup window directed at the Epic login page.
 *   3. Poll the popup every 500 ms.
 *   4. Once Epic redirects to its redirect page the popup URL changes.
 *      Attempt to read `window.location.search` for the `code` parameter.
 *      If the URL is accessible (same-origin or relaxed CSP), extract the code automatically.
 *   5. Resolve with success.
 *
 * Fallback flow (manual):
 *   If the redirect page is cross-origin (which Epic's redirect page is), automatic
 *   extraction will throw a SecurityError. The strategy falls back to a premium,
 *   dark-mode modal overlay that guides the user to copy the code from the Epic
 *   JSON response and paste it to complete the connection.
 *
 * Why this approach:
 *   Epic locks its public client ID's redirect URI to its own hosted redirect page
 *   (https://www.epicgames.com/id/api/redirect), which returns a JSON payload
 *   containing the authorization code.  Localhost redirect servers and custom
 *   protocol handlers cannot be registered for this client ID.  The popup + polling
 *   approach is the only viable mechanism in a browser environment.
 */
export class BrowserEpicStrategy implements EpicAuthStrategy {
  async authenticate(): Promise<AuthenticationResult> {
    let loginUrl: string;
    try {
      loginUrl = await epicApi.getOAuthUrl();
    } catch {
      return { success: false, error: "Failed to fetch Epic login URL. Please check your connection." };
    }

    // --- Attempt: open popup and poll for automatic code extraction ---
    const popup = window.open(loginUrl, "EpicLogin", "width=560,height=700,left=200,top=100");
    if (!popup) {
      // Browser blocked the popup → fall through to manual flow with guidance
      return this.manualFallback(loginUrl);
    }

    return new Promise<AuthenticationResult>((resolve) => {
      const POLL_INTERVAL = 500;       // ms between checks
      const TIMEOUT_MS    = 5 * 60 * 1000; // 5-minute hard timeout
      const started = Date.now();

      const timer = setInterval(() => {
        // Hard timeout
        if (Date.now() - started > TIMEOUT_MS) {
          clearInterval(timer);
          popup.close();
          resolve({ success: false, error: "Authentication timed out after 5 minutes." });
          return;
        }

        // User closed the popup manually
        if (popup.closed) {
          clearInterval(timer);
          resolve({ success: false, cancelled: true });
          return;
        }

        // Attempt to read the popup's current URL.
        // This will throw a SecurityError while the popup is on a cross-origin page.
        try {
          const url = popup.location.href;

          // Epic's redirect page: https://www.epicgames.com/id/api/redirect?...
          if (url.includes("epicgames.com/id/api/redirect")) {
            const params = new URL(url).searchParams;
            const code = params.get("code");
            if (code) {
              clearInterval(timer);
              popup.close();
              resolve({ success: true, authorizationCode: code });
              return;
            }
          }

          // Epic's newer XSRF-based flow may embed the code in the page as JSON.
          // Attempt to read document body if same-origin.
          if (
            popup.document &&
            popup.location.hostname === "www.epicgames.com" &&
            popup.location.pathname.includes("/id/api/redirect")
          ) {
            try {
              const body = popup.document.body?.innerText?.trim();
              if (body) {
                const parsed = JSON.parse(body);
                const code = parsed?.authorizationCode || parsed?.code;
                if (code) {
                  clearInterval(timer);
                  popup.close();
                  resolve({ success: true, authorizationCode: code });
                  return;
                }
              }
            } catch {
              // JSON parse failed — not on redirect page yet, keep polling
            }
          }
        } catch {
          // Cross-origin access blocked — user is still on login screens. Keep polling.
        }
      }, POLL_INTERVAL);

      // If for any reason the popup closes (e.g. user navigates away and closes)
      // the `popup.closed` check above catches it on the next tick.
    }).catch(() => ({ success: false, error: "An unexpected error occurred during authentication." }))
      .then((result) => {
        // If automatic extraction was cancelled without a code, surface the manual fallback
        if (result.cancelled) {
          // We do NOT show the fallback on cancellation — user deliberately closed.
          return result;
        }
        if (!result.success && !result.cancelled) {
          return this.manualFallback(loginUrl);
        }
        return result;
      });
  }

  /**
   * Fallback: render a premium dark-mode modal overlay that guides the user to
   * manually copy the authorization code from Epic's JSON redirect page.
   *
   * This is intentionally a self-contained DOM operation so it has zero React
   * dependencies and can be invoked at any point in the authentication lifecycle.
   */
  private manualFallback(loginUrl: string): Promise<AuthenticationResult> {
    return new Promise<AuthenticationResult>((resolve) => {
      // Open Epic login in a new tab so the user can authenticate
      window.open(loginUrl, "_blank", "noopener");

      // ── Build overlay ────────────────────────────────────────────────
      const overlay = document.createElement("div");
      overlay.id   = "__epic-auth-overlay__";
      overlay.style.cssText = `
        position:fixed; inset:0; z-index:99999;
        display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,0.82);
        backdrop-filter:blur(10px);
        font-family:'Inter',system-ui,sans-serif;
        animation:__epicFadeIn__ 0.25s ease;
      `;

      const card = document.createElement("div");
      card.style.cssText = `
        background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);
        border:1px solid rgba(255,255,255,0.12);
        border-radius:20px;
        padding:40px 36px;
        width:480px; max-width:95vw;
        box-shadow:0 32px 80px rgba(0,0,0,0.6);
        color:#fff;
        position:relative;
      `;

      card.innerHTML = `
        <style>
          @keyframes __epicFadeIn__ { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
          #__epic-auth-overlay__ input {
            width:100%; box-sizing:border-box;
            background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.2);
            border-radius:10px; color:#fff;
            padding:12px 14px; font-size:14px; outline:none;
            transition:border-color 0.2s;
          }
          #__epic-auth-overlay__ input:focus { border-color:#6366f1; }
          #__epic-auth-overlay__ input::placeholder { color:rgba(255,255,255,0.35); }
          #__epic-auth-overlay__ button {
            border:none; border-radius:10px;
            padding:12px 20px; font-size:14px; font-weight:600;
            cursor:pointer; transition:opacity 0.2s;
          }
          #__epic-auth-overlay__ button:hover { opacity:0.85; }
          #__epic-auth-overlay__ .err { color:#f87171; font-size:13px; margin-top:8px; min-height:18px; }
        </style>

        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#2563eb"/>
            <path d="M8 12h16v2H8zM8 17h10v2H8z" fill="#fff"/>
          </svg>
          <span style="font-size:18px;font-weight:700;letter-spacing:-0.3px">Epic Games — Complete Sign-In</span>
        </div>

        <p style="color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;margin:0 0 20px">
          After signing in to Epic Games in the tab that just opened, you'll see a page
          containing a JSON response. Find the <code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-size:13px">"authorizationCode"</code>
          field and paste its value below.
        </p>

        <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:10px;padding:14px 16px;margin-bottom:20px">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:4px">EXAMPLE</p>
          <code style="font-size:12px;color:#a5b4fc;word-break:break-all">"authorizationCode": "abc123..."</code>
        </div>

        <input id="__epic-code-input__" type="text" placeholder="Paste authorization code here" autocomplete="off" spellcheck="false" />
        <div class="err" id="__epic-code-err__"></div>

        <div style="display:flex;gap:12px;margin-top:20px">
          <button id="__epic-code-submit__"
            style="flex:1;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff">
            Connect Account
          </button>
          <button id="__epic-code-cancel__"
            style="background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.7)">
            Cancel
          </button>
        </div>
      `;

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      const input   = document.getElementById("__epic-code-input__")    as HTMLInputElement;
      const errEl   = document.getElementById("__epic-code-err__")      as HTMLElement;
      const submitBtn = document.getElementById("__epic-code-submit__") as HTMLButtonElement;
      const cancelBtn = document.getElementById("__epic-code-cancel__") as HTMLButtonElement;

      const destroy = () => overlay.remove();

      submitBtn.addEventListener("click", () => {
        const code = input.value.trim();
        if (!code) {
          errEl.textContent = "Please paste the authorization code before continuing.";
          return;
        }
        // Accept codes between 20 and 64 chars — Epic's codes are typically 32 hex chars
        if (code.length < 20 || code.length > 64) {
          errEl.textContent = "That doesn't look like a valid authorization code. Please check and try again.";
          return;
        }
        destroy();
        resolve({ success: true, authorizationCode: code });
      });

      cancelBtn.addEventListener("click", () => {
        destroy();
        resolve({ success: false, cancelled: true });
      });

      // Allow submitting with Enter key
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitBtn.click();
        if (e.key === "Escape") cancelBtn.click();
      });

      // Focus the input after a short delay (overlay animation)
      setTimeout(() => input.focus(), 300);
    });
  }
}
