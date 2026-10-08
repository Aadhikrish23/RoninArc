import { appError, bearerAuth, dateTime, failed, jsonBody, nullable, ok, pathParam, ref, responses, type Schema } from "./common";

export const providerSchemas: Record<string, Schema> = {
  ProviderId: { type: "string", enum: ["steam", "epic"], description: "Supported store integrations." },
  ProviderStatus: {
    type: "object",
    required: ["connected", "importedGames"],
    properties: {
      connected: { type: "boolean" },
      displayName: nullable({ type: "string" }),
      connectedAt: nullable(dateTime),
      importedGames: { type: "integer", description: "Library games linked to this store." },
      lastSync: nullable(dateTime),
    },
  },
  SteamLocalGame: {
    type: "object",
    description: "A Steam game found installed on this PC (sent by the desktop app's scanner).",
    required: ["appId", "name"],
    properties: {
      appId: { type: ["integer", "string"], example: 1145360 },
      name: { type: "string", example: "Hades" },
      installPath: { type: "string", example: "C:/Steam/steamapps/common/Hades" },
      executable: { type: "string" },
    },
  },
  EpicLocalGame: {
    type: "object",
    description: "An Epic game found installed on this PC.",
    properties: {
      catalogItemId: { type: "string" },
      name: { type: "string" },
      installPath: { type: "string" },
      epicId: { type: "string" },
      executable: { type: "string" },
    },
  },
  InstallationReport: {
    type: "object",
    required: ["scanned", "updated", "installed", "removed"],
    properties: {
      scanned: { type: "integer", description: "Games reported by the scan." },
      updated: { type: "integer", description: "Library entries changed." },
      installed: { type: "integer", description: "Scanned games matched or (Steam only) imported." },
      removed: { type: "integer", description: "Previously installed games now missing, marked uninstalled." },
    },
  },
  ConnectResult: {
    type: "object",
    required: ["connected", "totalGames"],
    properties: { connected: { const: true }, displayName: nullable({ type: "string" }), totalGames: { type: "integer" } },
  },
  ResyncResult: {
    type: "object",
    required: ["totalGames"],
    properties: { imported: { type: "integer" }, totalGames: { type: "integer" } },
  },
};

const provider = pathParam("providerId", "Store integration.", ref("ProviderId"));
const unknownProvider = appError("Unknown provider id.", "Unknown provider: gog");
const tags = ["Providers"];

export const providerPaths = {
  "/provider/installations/refresh": {
    post: {
      tags,
      summary: "Sync which games are installed on this PC",
      description:
        "The desktop app scans local Steam/Epic installs and posts them here. Matches mark library games installed; missing ones are marked uninstalled. Steam installs not yet in the library are imported. Unknown providers are skipped.",
      security: bearerAuth,
      requestBody: jsonBody(
        {
          type: "object",
          properties: {
            installations: {
              type: "object",
              properties: {
                steam: { type: "array", items: ref("SteamLocalGame") },
                epic: { type: "array", items: ref("EpicLocalGame") },
              },
              additionalProperties: { type: "array" },
            },
          },
        },
        { installations: { steam: [{ appId: 1145360, name: "Hades", installPath: "C:/Steam/steamapps/common/Hades" }] } },
        undefined,
        false,
      ),
      responses: {
        200: ok("One report per provider in the request.", {
          type: "object",
          properties: { steam: ref("InstallationReport"), epic: ref("InstallationReport") },
        }),
        401: responses.unauthorized,
      },
    },
  },
  "/provider/{providerId}/status": {
    get: {
      tags,
      summary: "Connection status",
      security: bearerAuth,
      parameters: [provider],
      responses: { 200: ok("Status.", ref("ProviderStatus")), 401: responses.unauthorized, 404: unknownProvider },
    },
  },
  "/provider/{providerId}/oauth/start": {
    get: {
      tags,
      summary: "Get the store sign-in URL",
      description: "Steam returns an OpenID URL whose `return_to` is this server's `/provider/steam/oauth/return`; Epic returns its login page.",
      security: bearerAuth,
      parameters: [provider],
      responses: {
        200: ok("Sign-in URL to open in a popup / browser window.", {
          type: "object",
          required: ["loginUrl"],
          properties: { loginUrl: { type: "string", format: "uri" } },
        }),
        400: failed("The provider has no OAuth flow.", "OAuth not supported for this provider"),
        401: responses.unauthorized,
        404: unknownProvider,
      },
    },
  },
  "/provider/{providerId}/oauth/return": {
    get: {
      tags,
      summary: "Sign-in redirect landing page (no auth)",
      description:
        "Where the store's login redirects. Renders a tiny HTML page that posts the raw query string back to `window.opener` and closes itself; verification happens in `/connect`. Query values are embedded safely (no script injection).",
      parameters: [provider],
      responses: {
        200: { description: "HTML hand-off page.", content: { "text/html": { schema: { type: "string" } } } },
      },
    },
  },
  "/provider/{providerId}/connect": {
    post: {
      tags,
      summary: "Connect a store account and import its library",
      description:
        "Steam: send the `openIdParams` query string from the return page (verified with Steam before anything is saved). Epic: send the `authorizationCode`.",
      security: bearerAuth,
      parameters: [provider],
      requestBody: jsonBody(
        {
          type: "object",
          properties: {
            openIdParams: { type: "string", description: "Steam only." },
            authorizationCode: { type: "string", description: "Epic only." },
            localGames: { type: "array", items: { type: "object" }, description: "Optional local scan to mark installs." },
          },
        },
        { openIdParams: "openid.ns=…&openid.mode=id_res&openid.claimed_id=…" },
      ),
      responses: {
        200: ok("Connected.", ref("ConnectResult")),
        400: appError(
          "Missing sign-in data, or the Steam profile's game details are private.",
          "Missing Steam sign-in response. Please try connecting again.",
          "Missing Epic Games authorization code. Please try connecting again.",
          'Steam returned no library data. This usually means the account\'s "Game details" privacy setting is not Public.',
        ),
        401: appError("Sign-in could not be verified (or not authenticated).", "Steam sign-in could not be verified. Please try again."),
        404: unknownProvider,
        500: appError(
          "Store sync isn't configured on this server, or the store's API failed.",
          "Steam sync is not configured: STEAM_API_KEY is missing from the backend environment. Get a free key at https://steamcommunity.com/dev/apikey",
        ),
      },
    },
  },
  "/provider/{providerId}/disconnect": {
    delete: {
      tags,
      summary: "Disconnect a store account",
      description: "Idempotent. Unlinks the store from library games.",
      security: bearerAuth,
      parameters: [provider],
      responses: {
        200: {
          description: "Disconnected.",
          content: { "application/json": { schema: { type: "object", required: ["Status"], properties: { Status: { const: "Success" } } } } },
        },
        401: responses.unauthorized,
        404: unknownProvider,
      },
    },
  },
  "/provider/{providerId}/resync": {
    post: {
      tags,
      summary: "Re-import the store library",
      security: bearerAuth,
      parameters: [provider],
      requestBody: jsonBody({ type: "object", properties: { localGames: { type: "array", items: { type: "object" } } } }, undefined, undefined, false),
      responses: {
        200: ok("Re-synced.", ref("ResyncResult")),
        400: appError("Not connected.", "Steam account is not connected. Please reconnect.", "Epic account is not connected. Please reconnect."),
        401: responses.unauthorized,
        404: unknownProvider,
        500: responses.internal,
      },
    },
  },
};
