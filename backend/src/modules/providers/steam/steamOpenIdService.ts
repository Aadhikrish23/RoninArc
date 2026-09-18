import axios from "axios";

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const CLAIMED_ID_PATTERN = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

/**
 * Steam has no OAuth/API-key login for end users -- identity is proven via
 * OpenID 2.0 ("Sign in through Steam"), then the resulting SteamID64 is used
 * with the separate, app-level Steam Web API key (see steamWebApiService) to
 * read that account's owned games. return_to/realm point at our own backend
 * relay route (see providerRoutes.ts) so both the Electron and browser
 * strategies can capture the response themselves -- see ElectronSteamStrategy
 * and BrowserSteamStrategy on the frontend.
 */
const getLoginUrl = (returnToUrl: string): string => {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnToUrl,
    "openid.realm": returnToUrl,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });

  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
};

/**
 * Verifies a Steam OpenID response ("dumb mode" verification: echo the
 * provider's signed params back to it with mode=check_authentication).
 * Returns the verified SteamID64, or null if the assertion is invalid.
 */
const verifyAssertion = async (openIdParams: string | Record<string, string>): Promise<string | null> => {
  const params = new URLSearchParams(openIdParams);

  if (params.get("openid.mode") !== "id_res") {
    return null;
  }

  const claimedId = params.get("openid.claimed_id") || "";
  const match = claimedId.match(CLAIMED_ID_PATTERN);
  if (!match) {
    return null;
  }

  params.set("openid.mode", "check_authentication");

  const response = await axios.post(STEAM_OPENID_ENDPOINT, params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const isValid = /is_valid\s*:\s*true/.test(response.data);
  if (!isValid) {
    return null;
  }

  return match[1];
};

export default {
  getLoginUrl,
  verifyAssertion,
};
