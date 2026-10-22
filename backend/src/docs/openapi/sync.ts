import { isCloud } from "../../shared/runtimeMode";
import { appError, bearerAuth, dateTime, jsonBody, okMessage, ref, responses, type Schema } from "./common";

const anyDoc: Schema = { type: "object", additionalProperties: true, description: "A document in MongoDB Extended JSON (ids as `{ \"$oid\": ... }`, dates as `{ \"$date\": ... }`)." };
const docsByCollection: Schema = {
  type: "object",
  description: "Documents keyed by collection: games, collections, reviews, notes, playSessions, activities, feedback.",
  additionalProperties: { type: "array", items: anyDoc },
};

export const syncSchemas: Record<string, Schema> = {
  SyncStatus: {
    type: "object",
    required: ["available", "linked", "pending"],
    properties: {
      available: { type: "boolean", description: "This build can reach RoninArc Cloud." },
      linked: { type: "boolean", description: "This account syncs with a RoninArc Cloud account." },
      cloudUsername: { type: ["string", "null"] },
      lastSyncAt: { oneOf: [dateTime, { type: "null" }] },
      lastError: { type: ["string", "null"], description: "Why the last sync didn't finish, in plain words (e.g. offline)." },
      needsSignIn: { type: "boolean", description: "The cloud refused this PC's session (password changed elsewhere): sign in again." },
      pending: {
        type: "object",
        required: ["changes", "deletes"],
        properties: { changes: { type: "integer", minimum: 0 }, deletes: { type: "integer", minimum: 0 } },
      },
      moved: { type: "boolean", description: "Linking took over an existing cloud account's id: use `session` from now on." },
      session: { ...ref("TokenPair"), description: "New sign-in for this PC, when the account id changed." },
    },
  },
  SyncLinkRequest: {
    type: "object",
    required: ["mode", "username", "password"],
    properties: {
      mode: { enum: ["create", "signin"], description: "`create`: a new cloud account from this PC's library. `signin`: an existing cloud account (this PC's library merges into it)." },
      username: { type: "string", example: "ronin" },
      email: { type: "string", description: "Required to create a cloud account (password resets go there).", example: "ronin@example.com" },
      password: { type: "string", format: "password", example: "Sup3rSecret!" },
    },
  },
  SyncPushRequest: {
    type: "object",
    properties: {
      changes: docsByCollection,
      deletes: {
        type: "array",
        items: {
          type: "object",
          required: ["coll", "id", "deletedAt"],
          properties: { coll: { type: "string" }, id: { type: "string" }, deletedAt: { type: "string" } },
        },
      },
    },
  },
  SyncPushResult: {
    type: "object",
    required: ["accepted", "rejected", "remapped", "deletesAccepted"],
    properties: {
      accepted: { type: "object", additionalProperties: { type: "array", items: { type: "object", properties: { id: { type: "string" }, updatedAt: { type: "string" } } } } },
      rejected: { ...docsByCollection, description: "The cloud's newer version of changes it didn't take; the device should apply them." },
      remapped: {
        type: "array",
        description: "Ids merged into an existing document (the same game added on two devices).",
        items: { type: "object", required: ["coll", "from", "to"], properties: { coll: { type: "string" }, from: { type: "string" }, to: { type: "string" } } },
      },
      deletesAccepted: { type: "array", items: { type: "string" } },
    },
  },
  SyncPullResult: {
    type: "object",
    required: ["serverTime", "cursor", "hasMore", "changes", "deletes", "user"],
    properties: {
      serverTime: dateTime,
      cursor: { ...dateTime, description: "Pass back as `since` on the next pull." },
      hasMore: { type: "boolean" },
      changes: docsByCollection,
      deletes: { type: "array", items: { type: "object", properties: { coll: { type: "string" }, id: { type: "string" }, deletedAt: { type: "string" } } } },
      user: {
        type: "object",
        description: "The account's name, email and password hash, so a linked PC can sign in offline.",
        properties: { id: { type: "string" }, username: { type: "string" }, email: { type: ["string", "null"] }, passwordHash: { type: "string" } },
      },
    },
  },
  ForgotPasswordRequest: {
    type: "object",
    required: ["identifier"],
    properties: { identifier: { type: "string", description: "The account's email address or username.", example: "ronin@example.com" } },
  },
  ResetPasswordRequest: {
    type: "object",
    required: ["token", "password"],
    properties: { token: { type: "string", description: "From the emailed link." }, password: { type: "string", minLength: 6, format: "password" } },
  },
};

const tags = ["Sync"];
const rateLimited = appError("Too many attempts from this network; try again later.", "Too many reset requests. Try again in a few minutes.");
const statusResponse = (description: string) => ({ description, content: { "application/json": { schema: ref("SyncStatus") } } });

const forgotPassword = {
  "/auth/forgot-password": {
    post: {
      tags: ["Auth"],
      summary: "Email a password reset link",
      description:
        "Emails a single-use link (valid 30 minutes) to the account with this email or username. Always answers the same way, so it can't reveal who has an account. On a PC, accounts that sync with RoninArc Cloud reset through the cloud.",
      requestBody: jsonBody(ref("ForgotPasswordRequest"), { identifier: "ronin@example.com" }),
      responses: {
        200: okMessage("Sent if an account matches.", "If an account matches, we've emailed a link to reset its password. Check your inbox (and spam)."),
        400: appError("No email or username given.", "Enter your email address or username."),
        429: rateLimited,
        502: appError("RoninArc Cloud failed (on a PC).", "Couldn't ask RoninArc Cloud for a reset link."),
        503: appError("RoninArc Cloud isn't reachable or set up (on a PC).", "Couldn't reach RoninArc Cloud. Check your internet connection and try again."),
      },
    },
  },
};

const cloudPaths = {
  ...forgotPassword,
  "/auth/reset-password": {
    get: {
      tags: ["Auth"],
      summary: "The page a reset link opens",
      description: "A small HTML form that sets the new password through `POST /auth/reset-password`.",
      responses: { 200: { description: "The reset form.", content: { "text/html": { schema: { type: "string" } } } } },
    },
    post: {
      tags: ["Auth"],
      summary: "Set a new password from a reset link",
      description: "Single use. Signs every device out (their refresh tokens stop working).",
      requestBody: jsonBody(ref("ResetPasswordRequest"), { token: "Vq3…", password: "N3wSecret!" }),
      responses: {
        200: okMessage("Password changed.", "Your password is changed. Sign in with it."),
        400: appError("Expired, used or unknown link; or a password under 6 characters.", "This reset link has expired or was already used. Ask for a new one.", "Use at least 6 characters."),
        429: rateLimited,
      },
    },
  },
  "/sync/register": {
    post: {
      tags,
      summary: "Create a cloud account for a PC's library",
      description: "Like `POST /auth/register`, but keeps the PC account's id so its library syncs without renumbering.",
      requestBody: jsonBody(
        { allOf: [ref("RegisterRequest"), { type: "object", properties: { userId: { type: "string", description: "The PC account's id." } } }] },
        { username: "ronin", password: "Sup3rSecret!", email: "ronin@example.com", userId: "6a8f00c2b1d3e4f5a6b7c8d9" },
      ),
      responses: {
        201: { description: "Account created and signed in.", content: { "application/json": { schema: { type: "object", properties: { Status: { const: "Success" }, Data: ref("AuthSession") } } } } },
        400: appError("Missing or invalid fields (cloud accounts need an email).", "Enter a valid email address. It's how you reset a forgotten password."),
        409: appError("Username or email taken, or the id is in use.", "Username is already taken", "An account with this email already exists. Sign in, or reset its password."),
        429: rateLimited,
      },
    },
  },
  "/sync/push": {
    post: {
      tags,
      summary: "Send a device's changes",
      description: "Newer change wins (by when it was made); the same thing created on two devices is merged and reported in `remapped`.",
      security: bearerAuth,
      requestBody: jsonBody(ref("SyncPushRequest"), { changes: {}, deletes: [] }),
      responses: {
        200: { description: "What the cloud took.", content: { "application/json": { schema: ref("SyncPushResult") } } },
        401: responses.unauthorized,
        413: appError("Too many changes in one push.", "Too many changes in one push (max 5000)."),
      },
    },
  },
  "/sync/pull": {
    get: {
      tags,
      summary: "Get changes since a cursor",
      security: bearerAuth,
      parameters: [{ name: "since", in: "query", required: false, description: "`cursor` from the previous pull.", schema: { type: "string" } }],
      responses: {
        200: { description: "Changes and deletions since `since`.", content: { "application/json": { schema: ref("SyncPullResult") } } },
        401: responses.unauthorized,
      },
    },
  },
};

const cloudLinkError = {
  400: appError("Missing or invalid fields.", "Username and password are required"),
  401: responses.unauthorized,
  409: appError("Already linked, or the cloud account name/email is taken.", "This account already syncs with RoninArc Cloud."),
  502: appError("RoninArc Cloud failed.", "Couldn't create the cloud account."),
  503: appError("RoninArc Cloud isn't reachable, or isn't set up in this build.", "Couldn't reach RoninArc Cloud. Check your internet connection and try again."),
};

const localPaths = {
  ...forgotPassword,
  "/sync/status": {
    get: { tags, summary: "This PC's sync state", security: bearerAuth, responses: { 200: statusResponse("Linked or not, last sync, what's waiting to go up."), 401: responses.unauthorized } },
  },
  "/sync/link": {
    post: {
      tags,
      summary: "Start syncing with RoninArc Cloud",
      description: "Creates a cloud account from this PC's library, or signs in to an existing one and merges this library into it, then syncs.",
      security: bearerAuth,
      requestBody: jsonBody(ref("SyncLinkRequest"), { mode: "create", username: "ronin", email: "ronin@example.com", password: "Sup3rSecret!" }),
      responses: { 200: statusResponse("Linked and synced."), ...cloudLinkError },
    },
  },
  "/sync/reconnect": {
    post: {
      tags,
      summary: "Sign in to the cloud again",
      description: "After the cloud refused this PC's session, e.g. the password was changed on the phone.",
      security: bearerAuth,
      requestBody: jsonBody({ type: "object", required: ["password"], properties: { password: { type: "string", format: "password" } } }, { password: "N3wSecret!" }),
      responses: { 200: statusResponse("Signed in again and synced."), ...cloudLinkError, 404: appError("Not linked.", "This account doesn't sync with RoninArc Cloud.") },
    },
  },
  "/sync/unlink": {
    post: { tags, summary: "Stop syncing", description: "The library stays on this PC; the cloud keeps its copy.", security: bearerAuth, responses: { 200: statusResponse("No longer syncing."), 401: responses.unauthorized } },
  },
  "/sync/now": {
    post: { tags, summary: "Sync now", description: "Sends this PC's changes, then gets the cloud's. Failures show in `lastError`.", security: bearerAuth, responses: { 200: statusResponse("Synced (or why not)."), 401: responses.unauthorized } },
  },
};

/** The routes this server mode actually serves (the cloud and a PC expose different ones). */
export const syncPaths = () => (isCloud() ? cloudPaths : localPaths);
