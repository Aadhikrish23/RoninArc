import { commonSchemas } from "./common";
import { authPaths, authSchemas } from "./auth";
import { libraryPaths, librarySchemas } from "./library";
import { engagementPaths, engagementSchemas } from "./engagement";
import { providerPaths, providerSchemas } from "./providers";
import { aiPaths, aiSchemas } from "./ai";
import { systemPaths, systemSchemas } from "./system";

const description = `
REST API behind the RoninArc game launcher: accounts, the game library, RAWG metadata, reviews, notes,
collections, play sessions, activity, Steam/Epic integration, cloud backup, recommendations and the AI assistant.

**Authentication.** Sign in with \`POST /auth/login\` (or register) and send the returned \`accessToken\` as
\`Authorization: Bearer <token>\`. Access tokens last 15 minutes; exchange the single-use \`refreshToken\` at
\`POST /auth/refresh\`. Use the **Authorize** button to try authenticated calls here.

**Responses.** Successful calls return \`{ "Status": "Success", "Data": ... }\` (or \`Message\`), except
\`/dashboard/stats\` and \`/ai/chat\`, which return their payload directly. Errors use one of:
\`{ "Status": "Fail" | "Error", "error": "..." }\` (most endpoints), \`{ "Status": "Failed", "Message": "..." }\`
(reviews, notes, collections, play sessions, activity, backup) or \`{ "success": false, "message": "..." }\` (AI).
Every response carries an \`X-Request-Id\` header that also appears in the server logs.

**Ownership.** Every resource is scoped to the signed-in user. Ids belonging to someone else behave as not found.
`.trim();

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "RoninArc API",
    version: process.env.APP_VERSION || "1.0.0",
    description,
  },
  servers: [{ url: "/", description: "This server" }],
  tags: [
    { name: "Auth", description: "Accounts, sessions and passwords." },
    { name: "Library", description: "The user's games." },
    { name: "RAWG", description: "Game metadata search (RAWG video game database)." },
    { name: "Dashboard", description: "Library statistics." },
    { name: "Reviews", description: "One 1-10 rating (plus optional text) per game." },
    { name: "Notes", description: "Free-text notes on a game." },
    { name: "Collections", description: "User-defined groups of games." },
    { name: "Activity", description: "What the user did, newest first." },
    { name: "Play sessions", description: "Playtime tracking." },
    { name: "Recommendations", description: "What to play next, and what to discover." },
    { name: "AI assistant", description: "Natural-language control of the library." },
    { name: "Providers", description: "Steam and Epic Games integrations." },
    { name: "Cloud backup", description: "Mirror to / restore from a cloud database." },
    { name: "System", description: "Health, logs and this document." },
  ],
  components: {
    securitySchemes: {
      BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Access token from login/register/refresh." },
    },
    schemas: {
      ...commonSchemas,
      ...authSchemas,
      ...librarySchemas,
      ...engagementSchemas,
      ...providerSchemas,
      ...aiSchemas,
      ...systemSchemas,
    },
  },
  paths: {
    ...systemPaths,
    ...authPaths,
    ...libraryPaths,
    ...engagementPaths,
    ...aiPaths,
    ...providerPaths,
  },
};

export default openApiDocument;
