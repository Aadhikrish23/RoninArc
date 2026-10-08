// Building blocks shared by every module's OpenAPI definitions.
//
// The API has three historical error envelopes, documented exactly as sent:
//   AppError        { Status: "Fail" | "Error", error }   -- global error handler
//   FailedResponse  { Status: "Failed", Message }         -- controllers that reply directly
//   AIChat errors   { success: false, message }           -- the AI assistant
export type Schema = Record<string, unknown>;

export const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });

export const objectId: Schema = {
  type: "string",
  pattern: "^[0-9a-fA-F]{24}$",
  description: "MongoDB ObjectId (24 hex characters).",
  example: "6a1f0c2b9e4d3a0012ab34cd",
};
export const dateTime: Schema = { type: "string", format: "date-time", example: "2026-10-09T14:03:12.000Z" };
export const nullable = (schema: Schema): Schema => ({ oneOf: [schema, { type: "null" }] });

export const bearerAuth = [{ BearerAuth: [] }];

export function jsonBody(schema: Schema, example?: unknown, description?: string, required = true) {
  return {
    required,
    ...(description ? { description } : {}),
    content: { "application/json": { schema, ...(example !== undefined ? { example } : {}) } },
  };
}

function jsonResponse(description: string, schema: Schema, example?: unknown) {
  return { description, content: { "application/json": { schema, ...(example !== undefined ? { example } : {}) } } };
}

/** `{ Status: "Success", Data: <schema> }` */
export function ok(description: string, data: Schema, example?: unknown) {
  return jsonResponse(
    description,
    { type: "object", required: ["Status", "Data"], properties: { Status: { const: "Success" }, Data: data } },
    example !== undefined ? { Status: "Success", Data: example } : undefined,
  );
}

/** `{ Status: "Success", Message: <text> }` */
export function okMessage(description: string, message: string) {
  return jsonResponse(description, ref("SuccessMessage"), { Status: "Success", Message: message });
}

/** Global error handler envelope. */
export function appError(description: string, ...messages: string[]) {
  return jsonResponse(description, ref("AppError"), { Status: "Fail", error: messages[0] ?? description });
}

/** Controller-level error envelope. */
export function failed(description: string, ...messages: string[]) {
  return jsonResponse(description, ref("FailedResponse"), { Status: "Failed", Message: messages[0] ?? description });
}

export const responses = {
  unauthorized: {
    description:
      "Missing, malformed or expired bearer token (`Not authenticated` / `Invalid or expired token`).",
    content: { "application/json": { schema: ref("AppError"), example: { Status: "Fail", error: "Not authenticated" } } },
  },
  malformedJson: {
    description: "The request body is not valid JSON.",
    content: { "application/json": { schema: ref("AppError"), example: { Status: "Fail", error: "Malformed JSON body" } } },
  },
  internal: {
    description: "Unexpected server error. Logged with a stack trace and reported to Sentry when configured.",
    content: {
      "application/json": { schema: ref("AppError"), example: { Status: "Fail", error: "Internal Server Error" } },
    },
  },
};

export const pathParam = (name: string, description: string, schema: Schema = { type: "string" }) => ({
  name,
  in: "path",
  required: true,
  description,
  schema,
});

export const queryParam = (name: string, description: string, schema: Schema, required = false) => ({
  name,
  in: "query",
  required,
  description,
  schema,
});

export const requestIdHeader = {
  "X-Request-Id": {
    description: "Correlation id for this request. Echoed from the request when well-formed, otherwise generated.",
    schema: { type: "string" },
  },
};

export const commonSchemas: Record<string, Schema> = {
  AppError: {
    type: "object",
    description: "Error envelope produced by the global error handler.",
    required: ["Status", "error"],
    properties: {
      Status: { enum: ["Fail", "Error"], description: "`Fail` for 4xx, `Error` for operational 5xx." },
      error: { type: "string", description: "Human-readable reason." },
    },
  },
  FailedResponse: {
    type: "object",
    description: "Error envelope produced by controllers that reply directly.",
    required: ["Status", "Message"],
    properties: { Status: { const: "Failed" }, Message: { type: "string" } },
  },
  SuccessMessage: {
    type: "object",
    required: ["Status", "Message"],
    properties: { Status: { const: "Success" }, Message: { type: "string" } },
  },
  ProgressStatus: {
    type: "string",
    enum: ["none", "plan", "playing", "paused", "completed", "dropped"],
    description: "Where the user is with a game. `none` = no status, `plan` = backlog.",
  },
};
