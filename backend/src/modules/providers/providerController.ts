import { Request, Response, NextFunction } from "express";
import ProviderRegistry from "./shared/ProviderRegistry";
import AppError from "../../shared/errors/AppError";

const getStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    const data = await provider.getStatus(req.user.id);
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error: any) {
    next(error);
  }
};

const connect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    const data = await provider.connect(req.user.id, req.body);
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error: any) {
    next(error);
  }
};

const disconnect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    await provider.disconnect(req.user.id);
    return res.status(200).json({ Status: "Success" });
  } catch (error: any) {
    next(error);
  }
};

const resync = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    const data = await provider.resync(req.user.id, req.body);
    return res.status(200).json({ Status: "Success", Data: data });
  } catch (error: any) {
    next(error);
  }
};

const startOAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { providerId } = req.params;
    const provider = ProviderRegistry.get(providerId);
    if (provider.getLoginUrl) {
      const url = await provider.getLoginUrl(req.user.id);
      return res.status(200).json({ Status: "Success", Data: { loginUrl: url } });
    }
    return res.status(400).json({ Status: "Failed", Message: "OAuth not supported for this provider" });
  } catch (error: any) {
    next(error);
  }
};

/**
 * Landing page for redirect-based provider sign-in flows (currently Steam's
 * OpenID login) whose return_to/realm we control. Renders a same-origin page
 * that hands the raw redirect query string back to window.opener via
 * postMessage (for the browser popup strategy) and closes itself; the
 * Electron strategy never lets this actually load, it intercepts the
 * navigation and reads the URL directly (see desktop/main.js). Deliberately
 * does no verification here -- that happens once, server-side, inside the
 * authenticated /connect call, exactly like Epic's authorization code.
 */
const oauthReturn = (req: Request, res: Response) => {
  const { providerId } = req.params;
  const rawParams = new URLSearchParams(req.query as Record<string, string>).toString();
  const safeParams = JSON.stringify(rawParams).replace(/<\/script/gi, "<\\/script");
  const safeProviderId = JSON.stringify(providerId).replace(/<\/script/gi, "<\\/script");

  // helmet's default Cross-Origin-Opener-Policy: same-origin would sever
  // window.opener for this cross-origin popup (opened from the :5173
  // frontend, landing here on :5000) before the script below ever runs --
  // this page's only job depends on that link still being there.
  res.set("Cross-Origin-Opener-Policy", "unsafe-none");
  res.set("Content-Type", "text/html");
  return res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>RoninArc</title></head>
<body style="font-family:sans-serif;background:#0f0f14;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <p id="msg">Signed in. You can close this window and return to RoninArc.</p>
  <script>
    (function () {
      var params = ${safeParams};
      if (window.opener) {
        window.opener.postMessage({ source: "roninarc-provider-oauth", providerId: ${safeProviderId}, params: params }, "*");
        window.close();
      }
    })();
  </script>
</body>
</html>`);
};

const refreshInstallations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reports: Record<string, any> = {};
    const { installations = {} } = req.body;
    
    for (const [providerId, localGames] of Object.entries(installations)) {
      try {
        const provider = ProviderRegistry.get(providerId);
        if (provider.refreshInstallations) {
          reports[providerId] = await provider.refreshInstallations(req.user.id, localGames as any[]);
        }
      } catch (err) {
        console.error(`[providerController] Failed to refresh installations for ${providerId}:`, err);
      }
    }
    return res.status(200).json({ Status: "Success", Data: reports });
  } catch (error: any) {
    next(error);
  }
};

export default {
  getStatus,
  connect,
  disconnect,
  resync,
  startOAuth,
  oauthReturn,
  refreshInstallations,
};

