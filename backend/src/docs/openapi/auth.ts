import { appError, bearerAuth, dateTime, jsonBody, objectId, ok, okMessage, ref, responses, type Schema } from "./common";

export const authSchemas: Record<string, Schema> = {
  Credentials: {
    type: "object",
    required: ["username", "password"],
    properties: {
      username: { type: "string", minLength: 3, description: "Trimmed and lower-cased; at least 3 characters.", example: "ronin" },
      password: { type: "string", minLength: 6, format: "password", description: "Trimmed; at least 6 characters.", example: "Sup3rSecret!" },
    },
  },
  RegisterRequest: {
    allOf: [
      ref("Credentials"),
      { type: "object", properties: { email: { type: "string", description: "Optional contact email.", example: "ronin@example.com" } } },
    ],
  },
  AuthSession: {
    type: "object",
    description: "Returned by register and login.",
    required: ["userdata", "accessToken", "refreshToken"],
    properties: {
      userdata: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", description: "The (lower-cased) username.", example: "ronin" },
          email: { type: "string", example: "ronin@example.com" },
          updatedAt: dateTime,
        },
      },
      accessToken: { type: "string", description: "JWT, valid for 15 minutes. Send as `Authorization: Bearer <token>`." },
      refreshToken: { type: "string", pattern: "^[0-9a-f]{128}$", description: "Opaque token, valid 30 days, single-use (rotated on refresh)." },
    },
  },
  TokenPair: {
    type: "object",
    required: ["accessToken", "refreshToken"],
    properties: { accessToken: { type: "string" }, refreshToken: { type: "string" } },
  },
  RefreshTokenRequest: {
    type: "object",
    required: ["refreshToken"],
    properties: { refreshToken: { type: "string", example: "9f2c…(128 hex chars)" } },
  },
  UserProfile: {
    type: "object",
    required: ["id", "username"],
    properties: {
      id: objectId,
      username: { type: "string", example: "ronin" },
      email: { type: "string", example: "ronin@example.com" },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
};

const tags = ["Auth"];

export const authPaths = {
  "/auth/register": {
    post: {
      tags,
      summary: "Create an account",
      description: "Creates a user and signs them in. Usernames are unique case-insensitively.",
      requestBody: jsonBody(ref("RegisterRequest"), { username: "ronin", password: "Sup3rSecret!", email: "ronin@example.com" }),
      responses: {
        201: { ...ok("Account created and signed in.", ref("AuthSession")), description: "Account created and signed in." },
        400: appError("Missing fields, or username < 3 / password < 6 characters.", "Username and password are required", "Invalid input"),
        409: appError("Username already taken.", "Username is already taken"),
      },
    },
  },
  "/auth/login": {
    post: {
      tags,
      summary: "Sign in",
      description: "Unknown users and wrong passwords get the same 401, so usernames can't be probed.",
      requestBody: jsonBody(ref("Credentials"), { username: "ronin", password: "Sup3rSecret!" }),
      responses: {
        200: ok("Signed in.", ref("AuthSession")),
        400: appError("Missing or too-short credentials.", "Username and password are required"),
        401: appError("Wrong username or password.", "Invalid credentials"),
      },
    },
  },
  "/auth/refresh": {
    post: {
      tags,
      summary: "Exchange a refresh token for a new token pair",
      description: "The refresh token is single-use: the old one is revoked and a new one returned.",
      requestBody: jsonBody(ref("RefreshTokenRequest")),
      responses: {
        200: ok("New token pair.", ref("TokenPair")),
        400: appError("No refresh token given.", "Refresh token is required"),
        401: appError("Token revoked, expired or unknown.", "Refresh token revoked", "Refresh token expired"),
        404: appError("The token's user no longer exists.", "User not found"),
      },
    },
  },
  "/auth/logout": {
    post: {
      tags,
      summary: "Sign out this device",
      description: "Revokes the given refresh token. The current access token stays valid until it expires (≤15 min).",
      requestBody: jsonBody(ref("RefreshTokenRequest")),
      responses: {
        200: okMessage("Signed out.", "Logged out successfully"),
        400: appError("No refresh token given.", "Refresh token is required"),
      },
    },
  },
  "/auth/me": {
    get: {
      tags,
      summary: "Current user's profile",
      security: bearerAuth,
      responses: {
        200: ok("Profile of the signed-in user.", ref("UserProfile")),
        401: responses.unauthorized,
        404: appError("The account was deleted after the token was issued.", "User not found"),
      },
    },
  },
  "/auth/change-password": {
    patch: {
      tags,
      summary: "Change password",
      description: "Signs out every device (all refresh tokens are revoked).",
      security: bearerAuth,
      requestBody: jsonBody(
        {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", format: "password" },
            newPassword: { type: "string", format: "password", minLength: 6, description: "Must differ from the current password." },
          },
        },
        { currentPassword: "Sup3rSecret!", newPassword: "Brand-New-Pass-42" },
      ),
      responses: {
        200: okMessage("Password changed.", "Password changed successfully"),
        400: appError(
          "Missing fields, new password too short, or unchanged.",
          "Current password and new password are required",
          "New password must be at least 6 characters",
          "New password must be different",
        ),
        401: appError("Current password incorrect, or not signed in.", "Current password incorrect"),
        404: appError("User not found.", "User not found"),
      },
    },
  },
  "/auth/account": {
    delete: {
      tags,
      summary: "Delete account and all data",
      description:
        "Permanently deletes the user and their library, reviews, notes, collections, sessions, activity, provider links and recommendation feedback. Cloud backups are kept.",
      security: bearerAuth,
      requestBody: jsonBody({ type: "object", required: ["password"], properties: { password: { type: "string", format: "password" } } }),
      responses: {
        200: okMessage("Account deleted.", "Account deleted successfully"),
        400: appError("No password given.", "Password is required"),
        401: appError("Wrong password, or not signed in.", "Invalid password"),
        404: appError("User not found.", "User not found"),
      },
    },
  },
  "/auth/logout-all": {
    post: {
      tags,
      summary: "Sign out every device",
      security: bearerAuth,
      responses: {
        200: okMessage("All refresh tokens revoked.", "Logged out from all devices"),
        401: responses.unauthorized,
      },
    },
  },
};
