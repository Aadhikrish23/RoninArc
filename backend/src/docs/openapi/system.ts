import { appError, bearerAuth, failed, jsonBody, ok, responses, type Schema } from "./common";

export const systemSchemas: Record<string, Schema> = {
  ClientLogEntry: {
    type: "object",
    required: ["level", "message"],
    properties: {
      level: { type: "string", enum: ["debug", "info", "warn", "error"] },
      message: { type: "string", minLength: 1, maxLength: 2000 },
      stack: { type: "string", maxLength: 8000 },
      context: { type: "object", description: "Free-form JSON, at most 4000 bytes serialized.", additionalProperties: true },
      url: { type: "string", maxLength: 500 },
      timestamp: { type: "string", maxLength: 500, description: "When it happened on the client (ISO 8601)." },
      requestId: { type: "string", maxLength: 500, description: "X-Request-Id of a failed API call, for correlation." },
      sessionId: { type: "string", maxLength: 500 },
      release: { type: "string", maxLength: 500 },
    },
  },
  BackupPushResult: {
    type: "object",
    required: ["collections", "documents"],
    properties: {
      collections: { type: "integer", description: "User-scoped collections mirrored." },
      documents: { type: "integer", description: "Documents written (including the user record)." },
    },
  },
  RestoreResult: {
    type: "object",
    required: ["username", "documents"],
    properties: { username: { type: "string" }, documents: { type: "integer" } },
  },
};

export const systemPaths = {
  "/health": {
    get: {
      tags: ["System"],
      summary: "Liveness check",
      responses: {
        200: {
          description: "The server is up.",
          content: {
            "application/json": {
              schema: { type: "object", required: ["Status"], properties: { Status: { const: "ok" }, message: { type: "string" } } },
            },
          },
        },
      },
    },
  },
  "/api/docs.json": {
    get: {
      tags: ["System"],
      summary: "This OpenAPI document (JSON)",
      responses: { 200: { description: "OpenAPI 3.1 document.", content: { "application/json": { schema: { type: "object" } } } } },
    },
  },
  "/logs/client": {
    post: {
      tags: ["System"],
      summary: "Ingest client-side logs",
      description:
        "The frontend batches errors (window errors, unhandled rejections, render crashes, failed API calls) and posts them here; they land in the same JSON log files as server logs. Auth is optional (a valid token attaches the user id) so crashes on the login page are still reported. Rate-limited to 300 entries/minute per user (or per IP when anonymous).",
      security: [{}, ...bearerAuth],
      requestBody: jsonBody(
        {
          type: "object",
          required: ["entries"],
          properties: { entries: { type: "array", minItems: 1, maxItems: 50, items: { $ref: "#/components/schemas/ClientLogEntry" } } },
        },
        { entries: [{ level: "error", message: "Cannot read properties of null (reading 'map')", url: "http://localhost/#/dashboard" }] },
        "Up to 50 entries; body up to 256 KB.",
      ),
      responses: {
        202: ok("Accepted and written to the log.", { type: "object", required: ["accepted"], properties: { accepted: { type: "integer" } } }),
        400: appError("Invalid batch (reason names the offending entry).", "entries must be a non-empty array", "entries[0]: message is required"),
        413: appError("Body larger than 256 KB.", "Request body too large"),
        429: appError("Rate limit exceeded.", "Too many log entries, slow down"),
      },
    },
  },
  "/backup/push": {
    post: {
      tags: ["Cloud backup"],
      summary: "Back up the current user to the cloud now",
      description: "Mirrors the user and all their data to the configured cloud database (Atlas_URL). Also runs automatically every 20 minutes.",
      security: bearerAuth,
      responses: {
        200: ok("Backed up.", { $ref: "#/components/schemas/BackupPushResult" }),
        401: responses.unauthorized,
        404: failed("User not found.", "User not found"),
        500: failed(
          "Cloud backup isn't configured or failed.",
          "Cloud backup is not configured: Atlas_URL is missing from the backend environment.",
        ),
      },
    },
  },
  "/backup/restore": {
    post: {
      tags: ["Cloud backup"],
      summary: "Restore an account from the cloud (no auth)",
      description:
        "For a fresh install: verifies the password against the cloud copy and recreates the account and its data locally. Refuses when the account already exists locally.",
      requestBody: jsonBody(
        {
          type: "object",
          required: ["username", "password"],
          properties: { username: { type: "string" }, password: { type: "string", format: "password" } },
        },
        { username: "ronin", password: "Sup3rSecret!" },
      ),
      responses: {
        200: ok("Restored; the user can now log in.", { $ref: "#/components/schemas/RestoreResult" }),
        400: failed("Missing credentials.", "Username and password are required"),
        401: failed("Wrong password.", "Invalid credentials"),
        404: failed("No cloud backup for this username.", "No cloud backup found for this account."),
        409: failed("The account already exists on this device.", "This account already exists on this device. Just log in normally."),
        500: failed("Cloud backup isn't configured or failed.", "Restore failed"),
      },
    },
  },
};
