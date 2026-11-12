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
      cloudUsername: { type: ["string", "null"], description: "The cloud account's internal handle." },
      cloudEmail: { type: ["string", "null"], description: "The email this PC signs in to the cloud with (\"Syncing as ...\")." },
      lastSyncAt: { oneOf: [dateTime, { type: "null" }] },
      lastError: { type: ["string", "null"], description: "Why the last sync didn't finish, in plain words (e.g. offline)." },
      needsSignIn: { type: "boolean", description: "The cloud refused this PC's session (password changed elsewhere): sign in again." },
      pending: {
        type: "object",
        required: ["changes", "deletes"],
        properties: { changes: { type: "integer", minimum: 0 }, deletes: { type: "integer", minimum: 0 } },
      },
      moved: { type: "boolean", description: "Linking took over an existing cloud account's id: use `session` from now on." },
      session: {
        type: "object",
        description: "New sign-in for this PC, when the account id changed.",
        required: ["accessToken", "refreshToken"],
        properties: { accessToken: { type: "string" }, refreshToken: { type: "string" }, userdata: ref("UserData") },
      },
      phoneLinked: { type: "boolean", description: "A phone has signed in to this cloud account, so the PC stops offering \"get your library on your phone\"." },
      autoLink: {
        type: ["object", "null"],
        description: "\"Sync with my other devices\" was ticked at sign-in but this PC isn't linked yet.",
        properties: {
          waiting: { type: "boolean", description: "Waiting for internet; retried every minute." },
          attention: {
            type: ["string", "null"],
            enum: ["email-taken", "needs-email", "failed", null],
            description: "Needs the person: `email-taken` means the email already has a cloud account with a different password (enter it to sync with it); `needs-email` means this account has no email yet.",
          },
          message: { type: ["string", "null"] },
        },
      },
      result: { enum: ["linked", "waiting", "needs-attention", "unavailable"], description: "Only from `POST /sync/auto-link`." },
    },
  },
  LinkCode: {
    type: "object",
    required: ["code", "expiresAt"],
    properties: {
      code: { type: "string", pattern: "^[0-9]{6}$", description: "Shown on the PC, with a QR code of `roninarc://link/<code>`. Works once, for 10 minutes.", example: "482913" },
      expiresAt: dateTime,
    },
  },
  SyncLinkRequest: {
    type: "object",
    required: ["mode"],
    properties: {
      mode: { enum: ["create", "signin"], description: "`create`: a new cloud account from this PC's library. `signin`: an existing cloud account (this PC's library merges into it)." },
      email: { type: "string", description: "Required to sign in. To create, defaults to this PC's account's email.", example: "ronin@example.com" },
      password: { type: "string", format: "password", description: "Required to sign in. To create, leave it out to keep this PC's password.", example: "Sup3rSecret!" },
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
        properties: {
          id: { type: "string" },
          username: { type: "string" },
          displayName: { type: ["string", "null"] },
          email: { type: ["string", "null"] },
          passwordHash: { type: "string" },
          phoneLinkedAt: { oneOf: [dateTime, { type: "null" }], description: "When a phone first signed in to this account." },
        },
      },
    },
  },
  ForgotPasswordRequest: {
    type: "object",
    required: ["identifier"],
    properties: { identifier: { type: "string", description: "The account's email address.", example: "ronin@example.com" } },
  },
  ResetPasswordRequest: {
    type: "object",
    required: ["token", "password"],
    properties: { token: { type: "string", description: "From the emailed link." }, password: { type: "string", minLength: 8, format: "password" } },
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
        "Emails a single-use link (valid 30 minutes) to the account with this email. Always answers the same way, so it can't reveal who has an account. On a PC, accounts that sync with RoninArc Cloud reset through the cloud.",
      requestBody: jsonBody(ref("ForgotPasswordRequest"), { identifier: "ronin@example.com" }),
      responses: {
        200: okMessage("Sent if an account matches.", "If an account matches, we've emailed a link to reset its password. Check your inbox (and spam)."),
        400: appError("No email given.", "Enter your email address."),
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
        400: appError("Expired, used or unknown link; or a password under 8 characters.", "This reset link has expired or was already used. Ask for a new one.", "Use at least 8 characters."),
        429: rateLimited,
      },
    },
  },
  "/sync/register": {
    post: {
      tags,
      summary: "Create a cloud account for a PC's library",
      description:
        "Like `POST /auth/register`, but keeps the PC account's id so its library syncs without renumbering. Send `passwordHash` instead of `password` to keep the PC account's password. `username` is the PC account's internal handle, kept when it's free here (PCs before 1.0.3 send only this, as the name too).",
      requestBody: jsonBody(
        {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string" },
            displayName: { type: "string" },
            username: { type: "string", description: "The PC account's handle." },
            password: { type: "string", format: "password" },
            passwordHash: { type: "string", description: "The PC account's bcrypt hash (cost 10 to 12). Needs `userId`." },
            userId: { type: "string", description: "The PC account's id." },
          },
        },
        { email: "ronin@example.com", displayName: "Ronin", username: "ronin", password: "Sup3rSecret!", userId: "6a8f00c2b1d3e4f5a6b7c8d9" },
      ),
      responses: {
        201: { description: "Account created and signed in.", content: { "application/json": { schema: { type: "object", properties: { Status: { const: "Success" }, Data: ref("AuthSession") } } } } },
        400: appError("Missing or invalid fields.", "Email and password are required", "Enter a valid email address. You sign in with it, and it's how you reset a forgotten password."),
        409: appError("The email already has an account, or the id is in use.", "An account with this email already exists. Sign in, or reset its password."),
        429: rateLimited,
      },
    },
  },
  "/sync/link-code": {
    post: {
      tags,
      summary: "A code for a phone to sign in with",
      description: "For a signed-in account (a linked PC asks on its owner's behalf). Replaces any earlier code. Stored only as a keyed hash.",
      security: bearerAuth,
      responses: {
        201: { description: "A new 6-digit code, valid 10 minutes.", content: { "application/json": { schema: ref("LinkCode") } } },
        401: responses.unauthorized,
        429: appError("Too many codes for this account.", "Too many codes. Wait a few minutes."),
      },
    },
  },
  "/sync/link-code/claim": {
    post: {
      tags,
      summary: "Sign a phone in with a code",
      description: "Trades the code shown on the PC for a session. Each code works once. Rate-limited per network.",
      requestBody: jsonBody({ type: "object", required: ["code"], properties: { code: { type: "string", description: "Six digits; spaces or a scanned `roninarc://link/…` are fine." } } }, { code: "482913" }),
      responses: {
        200: { description: "Signed in.", content: { "application/json": { schema: { type: "object", properties: { Status: { const: "Success" }, Data: ref("AuthSession") } } } } },
        400: appError("Not six digits, expired, already used or unknown.", "That code didn't work. Codes last 10 minutes and work once; make a new one on your PC."),
        429: appError("Too many tries from this network.", "Too many tries. Wait a few minutes, then make a new code on your PC."),
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
  400: appError("Missing or invalid fields, or no email on this account.", "Email and password are required", "Add your email to turn on sync."),
  401: responses.unauthorized,
  409: appError("Already linked, or the email already has a cloud account.", "This account already syncs with RoninArc Cloud.", "That email already has a RoninArc Cloud account. Enter its password to sync with it."),
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
      requestBody: jsonBody(ref("SyncLinkRequest"), { mode: "create" }),
      responses: { 200: statusResponse("Linked and synced."), ...cloudLinkError },
    },
  },
  "/sync/auto-link": {
    post: {
      tags,
      summary: "Sync with my other devices (at sign-in)",
      description:
        "Links like `POST /sync/link` in `create` mode but never fails: offline it waits and retries every minute; if the email already has a cloud account, the just-typed `password` tries signing in to it (merging, since it's the same person); otherwise the status says it needs attention (`email-taken`: enter that account's password; `needs-email`: add an email first).",
      security: bearerAuth,
      requestBody: jsonBody({ type: "object", properties: { password: { type: "string", format: "password", description: "Only to try the existing cloud account; not stored." } } }, { password: "Sup3rSecret!" }),
      responses: { 200: statusResponse("Linked, waiting, or needs attention (see `result`)."), 401: responses.unauthorized },
    },
    delete: {
      tags,
      summary: "Stop trying to link",
      description: "The person chose not to sync after all.",
      security: bearerAuth,
      responses: { 200: statusResponse("No longer waiting to link."), 401: responses.unauthorized },
    },
  },
  "/sync/phone-code": {
    post: {
      tags,
      summary: "A code for your phone",
      description: "Asks the cloud for a 6-digit code (shown with a QR code) that signs the phone in to this PC's cloud account, no password needed.",
      security: bearerAuth,
      responses: {
        201: { description: "A new code, valid 10 minutes.", content: { "application/json": { schema: ref("LinkCode") } } },
        401: responses.unauthorized,
        409: appError("This PC doesn't sync with the cloud yet, or must sign in again.", "Sync this PC with RoninArc Cloud first."),
        503: appError("RoninArc Cloud isn't reachable.", "Couldn't reach RoninArc Cloud. Check your internet connection and try again."),
      },
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
