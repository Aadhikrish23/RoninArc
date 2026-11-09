import { appError, bearerAuth, dateTime, jsonBody, objectId, ok, okMessage, ref, responses, type Schema } from "./common";

export const authSchemas: Record<string, Schema> = {
  Credentials: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email", description: "The account's email address (case doesn't matter).", example: "ronin@example.com" },
      password: { type: "string", minLength: 6, format: "password", description: "Trimmed; at least 6 characters.", example: "Sup3rSecret!" },
    },
  },
  RegisterRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      displayName: { type: "string", maxLength: 60, description: "The name shown in the app. Not unique. Defaults to the part of the email before @.", example: "Ronin" },
      email: { type: "string", format: "email", description: "How you sign in, and where password resets go. One account per email.", example: "ronin@example.com" },
      password: { type: "string", minLength: 6, format: "password", example: "Sup3rSecret!" },
    },
  },
  UserData: {
    type: "object",
    required: ["name", "displayName"],
    properties: {
      name: { type: "string", description: "The display name (same as `displayName`; kept for older apps).", example: "Ronin" },
      displayName: { type: "string", example: "Ronin" },
      email: { type: ["string", "null"], description: "Null only for a PC account made before email sign-in.", example: "ronin@example.com" },
      updatedAt: dateTime,
    },
  },
  AuthSession: {
    type: "object",
    description: "Returned by register and login.",
    required: ["userdata", "accessToken", "refreshToken"],
    properties: {
      userdata: ref("UserData"),
      accessToken: { type: "string", description: "JWT, valid for 15 minutes. Send as `Authorization: Bearer <token>`." },
      refreshToken: { type: "string", pattern: "^[0-9a-f]{128}$", description: "Opaque token, valid 30 days, single-use (rotated on refresh)." },
    },
  },
  SetEmailRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email", example: "ronin@example.com" },
      password: { type: "string", format: "password", description: "The account's current password, to confirm it's you." },
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
    required: ["id", "username", "displayName", "needsEmail"],
    properties: {
      id: objectId,
      username: { type: "string", description: "Internal handle, never typed or shown. Apps show `displayName`.", example: "ronin" },
      displayName: { type: "string", example: "Ronin" },
      email: { type: ["string", "null"], example: "ronin@example.com" },
      needsEmail: { type: "boolean", description: "A PC account made before email sign-in: the app asks for an email once." },
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
      description:
        "Creates an account and signs it in. You sign in with the email; the display name is only shown in the app and doesn't have to be unique. Repeating a sign-up that just succeeded (same email and password, within 10 minutes) signs in instead of failing. Apps before 1.0.3 send the name as `username`, which still works.",
      requestBody: jsonBody(ref("RegisterRequest"), { displayName: "Ronin", email: "ronin@example.com", password: "Sup3rSecret!" }),
      responses: {
        201: { ...ok("Account created and signed in.", ref("AuthSession")), description: "Account created and signed in." },
        400: appError("Missing or invalid email, or a password under 6 characters.", "Email and password are required", "Use a password of at least 6 characters."),
        409: appError("The email already has an account.", "An account with this email already exists. Sign in, or reset its password."),
      },
    },
  },
  "/auth/login": {
    post: {
      tags,
      summary: "Sign in",
      description:
        "Sign in with the account's email and password. A name instead of an email is refused with 400, except on a PC for an account made before email sign-in that has no email yet (it signs in, and the app then asks for an email). Unknown emails and wrong passwords get the same 401. Apps before 1.0.3 send the email as `username`, which still works. The phone app sends `X-RoninArc-Client: phone`, which tells a linked PC that a phone uses this account.",
      requestBody: jsonBody(ref("Credentials"), { email: "ronin@example.com", password: "Sup3rSecret!" }),
      responses: {
        200: ok("Signed in.", ref("AuthSession")),
        400: appError("No email (or not an email) or no password.", "Sign in with your email address and password."),
        401: appError("Wrong email or password.", "Wrong email or password."),
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
  "/auth/email": {
    patch: {
      tags,
      summary: "Add or change the account's email",
      description:
        "For accounts made before email sign-in, which need an email to sign in again and to sync. The current password confirms it. On a PC that syncs, RoninArc Cloud takes the email first. At most 10 tries per 15 minutes per account.",
      security: bearerAuth,
      requestBody: jsonBody(ref("SetEmailRequest"), { email: "ronin@example.com", password: "Sup3rSecret!" }),
      responses: {
        200: ok("Email saved.", ref("UserData")),
        400: appError("Not an email, or no password.", "Enter a valid email address. You sign in with it, and it's how you reset a forgotten password.", "Password is required"),
        401: appError("Wrong password (or not signed in).", "Wrong password."),
        409: appError("Another account uses the email.", "Another account already uses this email."),
        429: appError("Too many tries.", "Too many tries. Wait a few minutes."),
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
        "Permanently deletes the user and their library, reviews, notes, collections, sessions, activity, provider links and recommendation feedback.",
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
