import {
  bearerAuth,
  dateTime,
  failed,
  jsonBody,
  nullable,
  objectId,
  ok,
  okMessage,
  pathParam,
  queryParam,
  ref,
  responses,
  type Schema,
} from "./common";

export const engagementSchemas: Record<string, Schema> = {
  Review: {
    type: "object",
    required: ["_id", "userId", "gameId", "rating"],
    properties: {
      _id: objectId,
      userId: objectId,
      gameId: objectId,
      rating: { type: "integer", minimum: 1, maximum: 10, example: 9 },
      reviewText: { type: "string", example: "Tight combat, great music." },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  UpsertReviewRequest: {
    type: "object",
    required: ["rating"],
    properties: {
      rating: { type: "integer", minimum: 1, maximum: 10, description: "Whole number from 1 to 10." },
      reviewText: { type: "string", description: "Optional; trimmed." },
    },
  },
  Collection: {
    type: "object",
    required: ["_id", "userId", "name", "gameIds"],
    properties: {
      _id: objectId,
      userId: objectId,
      name: { type: "string", example: "Roguelikes" },
      description: { type: "string" },
      gameIds: {
        type: "array",
        description: "Game ids, or full library games where the endpoint populates them.",
        items: { oneOf: [objectId, ref("LibraryGame")] },
      },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  CollectionRequest: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", minLength: 1, description: "Trimmed. Unique per user (case-insensitive on create)." },
      description: { type: "string" },
    },
  },
  Note: {
    type: "object",
    required: ["_id", "userId", "gameId", "content"],
    properties: {
      _id: objectId,
      userId: objectId,
      gameId: objectId,
      content: { type: "string", maxLength: 2000 },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  NoteRequest: {
    type: "object",
    required: ["content"],
    properties: { content: { type: "string", minLength: 1, maxLength: 2000, description: "Trimmed; 1–2000 characters." } },
  },
  Activity: {
    type: "object",
    required: ["_id", "userId", "type", "message"],
    properties: {
      _id: objectId,
      userId: objectId,
      type: {
        type: "string",
        enum: [
          "GAME_ADDED", "GAME_REMOVED", "STATUS_CHANGED", "REVIEW_CREATED", "REVIEW_UPDATED", "REVIEW_DELETED",
          "COLLECTION_CREATED", "COLLECTION_DELETED", "GAME_ADDED_TO_COLLECTION", "GAME_REMOVED_FROM_COLLECTION",
          "GAME_LAUNCHED", "COLLECTION_UPDATED", "NOTE_CREATED", "NOTE_DELETED",
        ],
      },
      message: { type: "string", example: "Hades marked as completed" },
      gameId: nullable({ oneOf: [objectId, ref("LibraryGame")] }),
      collectionId: nullable({ oneOf: [objectId, ref("Collection")] }),
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  PlaySession: {
    type: "object",
    required: ["_id", "userId", "gameId", "startedAt"],
    properties: {
      _id: objectId,
      userId: objectId,
      gameId: { oneOf: [objectId, ref("LibraryGame"), { type: "null" }], description: "Populated on /play-session/recent." },
      startedAt: dateTime,
      endedAt: nullable(dateTime),
      durationMinutes: { type: "integer", description: "Whole minutes, set when the session ends." },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  PlaytimeStats: {
    type: "object",
    required: ["totalMinutes", "totalHours", "totalSessions", "averageSessionMinutes", "mostPlayedGame", "mostPlayedMinutes"],
    properties: {
      totalMinutes: { type: "integer" },
      totalHours: { type: "number", description: "Rounded to 1 decimal." },
      totalSessions: { type: "integer", description: "Completed sessions." },
      averageSessionMinutes: { type: "integer" },
      mostPlayedGame: nullable(ref("LibraryGame")),
      mostPlayedMinutes: { type: "integer" },
    },
  },
  GamePlaytime: {
    type: "object",
    required: ["totalHours", "lastPlayed"],
    properties: { totalHours: { type: "number" }, lastPlayed: nullable(dateTime) },
  },
};

const libraryGameId = (name = "gameId") => pathParam(name, "Library game id.", objectId);
const collectionId = pathParam("collectionId", "Collection id.", objectId);
const invalidGameId = failed("Malformed game id.", "Invalid game id");

export const engagementPaths = {
  "/review/{gameId}": {
    get: {
      tags: ["Reviews"],
      summary: "Get the user's review of a game",
      security: bearerAuth,
      parameters: [libraryGameId()],
      responses: {
        200: ok("The review, or `null` when the user hasn't reviewed it.", nullable(ref("Review"))),
        400: invalidGameId,
        401: responses.unauthorized,
        500: failed("Lookup failed.", "Failed to fetch review"),
      },
    },
    put: {
      tags: ["Reviews"],
      summary: "Create or update a review",
      description:
        "Upsert: one review per game. Records REVIEW_CREATED or REVIEW_UPDATED (nothing when unchanged). The game must be in the caller's library.",
      security: bearerAuth,
      parameters: [libraryGameId()],
      requestBody: jsonBody(ref("UpsertReviewRequest"), { rating: 9, reviewText: "Tight combat." }),
      responses: {
        200: ok("The saved review.", ref("Review")),
        400: failed("Malformed id, or invalid rating/text.", "Rating must be a whole number from 1 to 10", "Invalid game id", "Review text must be text"),
        401: responses.unauthorized,
        404: failed("The game isn't in the caller's library.", "Game not found in your library"),
        500: failed("Save failed.", "Failed to save review"),
      },
    },
    delete: {
      tags: ["Reviews"],
      summary: "Delete a review",
      description: "Deleting a review that doesn't exist is a no-op that still returns 200.",
      security: bearerAuth,
      parameters: [libraryGameId()],
      responses: {
        200: okMessage("Deleted (or nothing to delete).", "Review deleted"),
        400: invalidGameId,
        401: responses.unauthorized,
        500: failed("Delete failed.", "Failed to delete review"),
      },
    },
  },
  "/collection": {
    get: {
      tags: ["Collections"],
      summary: "List collections",
      description: "Newest first, with `gameIds` populated with full library games.",
      security: bearerAuth,
      responses: {
        200: ok("The user's collections.", { type: "array", items: ref("Collection") }),
        401: responses.unauthorized,
        500: failed("Lookup failed.", "Failed to fetch collections"),
      },
    },
    post: {
      tags: ["Collections"],
      summary: "Create a collection",
      description: "If a collection with the same name exists (case-insensitive), that one is returned instead.",
      security: bearerAuth,
      requestBody: jsonBody(ref("CollectionRequest"), { name: "Roguelikes", description: "Run-based games" }),
      responses: {
        201: ok("The created (or existing) collection; `gameIds` are ids.", ref("Collection")),
        400: failed("Missing or blank name.", "Collection name is required"),
        401: responses.unauthorized,
      },
    },
  },
  "/collection/{collectionId}": {
    get: {
      tags: ["Collections"],
      summary: "Get a collection",
      security: bearerAuth,
      parameters: [collectionId],
      responses: {
        200: ok("The collection with games populated.", ref("Collection")),
        401: responses.unauthorized,
        404: failed("Not found, malformed id, or another user's collection.", "Collection not found"),
      },
    },
    patch: {
      tags: ["Collections"],
      summary: "Rename / re-describe a collection",
      security: bearerAuth,
      parameters: [collectionId],
      requestBody: jsonBody(ref("CollectionRequest"), { name: "Favourite Roguelikes" }),
      responses: {
        200: ok("The updated collection.", ref("Collection")),
        400: failed(
          "Blank name, a name used by another collection, or not found.",
          "Collection with this name already exists",
          "Collection name is required",
          "Collection not found",
        ),
        401: responses.unauthorized,
      },
    },
    delete: {
      tags: ["Collections"],
      summary: "Delete a collection",
      description: "Only the collection is deleted; its games stay in the library.",
      security: bearerAuth,
      parameters: [collectionId],
      responses: {
        200: okMessage("Deleted.", "Collection deleted"),
        400: failed("Not found or another user's collection.", "Collection not found"),
        401: responses.unauthorized,
      },
    },
  },
  "/collection/{collectionId}/games": {
    post: {
      tags: ["Collections"],
      summary: "Add a game to a collection",
      description: "Idempotent. The game must be in the caller's library.",
      security: bearerAuth,
      parameters: [collectionId],
      requestBody: jsonBody({ type: "object", required: ["gameId"], properties: { gameId: objectId } }),
      responses: {
        200: ok("The collection with games populated.", ref("Collection")),
        400: failed(
          "Collection not found, missing/malformed game id, or game not owned.",
          "Game not found in your library",
          "Collection not found",
          "A valid gameId is required",
        ),
        401: responses.unauthorized,
      },
    },
  },
  "/collection/{collectionId}/games/{gameId}": {
    delete: {
      tags: ["Collections"],
      summary: "Remove a game from a collection",
      description: "Removing a game that isn't in the collection is a no-op.",
      security: bearerAuth,
      parameters: [collectionId, libraryGameId()],
      responses: {
        200: ok("The collection with games populated.", ref("Collection")),
        400: failed("Collection not found.", "Collection not found"),
        401: responses.unauthorized,
      },
    },
  },
  "/notes/{id}": {
    get: {
      tags: ["Notes"],
      summary: "List notes for a game",
      description: "`id` is a **library game id**. Newest first.",
      security: bearerAuth,
      parameters: [pathParam("id", "Library game id.", objectId)],
      responses: {
        200: ok("The notes (possibly empty).", { type: "array", items: ref("Note") }),
        400: invalidGameId,
        401: responses.unauthorized,
        500: failed("Lookup failed.", "Failed to fetch notes"),
      },
    },
    post: {
      tags: ["Notes"],
      summary: "Add a note to a game",
      description: "`id` is a **library game id**; the game must be in the caller's library. Records NOTE_CREATED.",
      security: bearerAuth,
      parameters: [pathParam("id", "Library game id.", objectId)],
      requestBody: jsonBody(ref("NoteRequest"), { content: "Use the shield against Theseus." }),
      responses: {
        201: ok("The created note.", ref("Note")),
        400: failed("Missing/too-long content or malformed id.", "Note content is required", "Note must be 2000 characters or fewer", "Invalid game id"),
        401: responses.unauthorized,
        404: failed("The game isn't in the caller's library.", "Game not found in your library"),
        500: failed("Create failed.", "Failed to create note"),
      },
    },
    patch: {
      tags: ["Notes"],
      summary: "Edit a note",
      description: "`id` is a **note id**.",
      security: bearerAuth,
      parameters: [pathParam("id", "Note id.", objectId)],
      requestBody: jsonBody(ref("NoteRequest")),
      responses: {
        200: ok("The updated note.", ref("Note")),
        400: failed("Missing or too-long content.", "Note content is required", "Note must be 2000 characters or fewer"),
        401: responses.unauthorized,
        404: failed("Not found, malformed id, or another user's note.", "Note not found"),
        500: failed("Update failed.", "Failed to update note"),
      },
    },
    delete: {
      tags: ["Notes"],
      summary: "Delete a note",
      description: "`id` is a **note id**. Records NOTE_DELETED.",
      security: bearerAuth,
      parameters: [pathParam("id", "Note id.", objectId)],
      responses: {
        200: okMessage("Deleted.", "Note deleted"),
        401: responses.unauthorized,
        404: failed("Not found, malformed id, or another user's note.", "Note not found"),
        500: failed("Delete failed.", "Failed to delete note"),
      },
    },
  },
  "/activity": {
    get: {
      tags: ["Activity"],
      summary: "Recent activity feed",
      description: "The 20 most recent entries, newest first, with game and collection populated.",
      security: bearerAuth,
      responses: {
        200: ok("Activity entries.", { type: "array", maxItems: 20, items: ref("Activity") }),
        401: responses.unauthorized,
        500: failed("Lookup failed.", "Failed to load activities"),
      },
    },
  },
  "/activity/launch/{gameId}": {
    post: {
      tags: ["Activity"],
      summary: "Record that a game was launched",
      security: bearerAuth,
      parameters: [libraryGameId()],
      responses: {
        200: {
          description: "Recorded (a GAME_LAUNCHED activity).",
          content: { "application/json": { schema: { type: "object", required: ["Status"], properties: { Status: { const: "Success" } } } } },
        },
        400: invalidGameId,
        401: responses.unauthorized,
        404: failed("Not in the caller's library.", "Game not found"),
        500: failed("Recording failed.", "Failed to record launch"),
      },
    },
  },
  "/play-session/start/{gameId}": {
    post: {
      tags: ["Play sessions"],
      summary: "Start a play session",
      description: "Returns the existing open session if one is already running for this game.",
      security: bearerAuth,
      parameters: [libraryGameId()],
      responses: {
        200: ok("The open session.", ref("PlaySession")),
        400: invalidGameId,
        401: responses.unauthorized,
        404: failed("Not in the caller's library.", "Game not found in your library"),
      },
    },
  },
  "/play-session/end/{gameId}": {
    post: {
      tags: ["Play sessions"],
      summary: "End the open play session",
      security: bearerAuth,
      parameters: [libraryGameId()],
      responses: {
        200: ok("The closed session, with `endedAt` and `durationMinutes`.", ref("PlaySession")),
        400: invalidGameId,
        401: responses.unauthorized,
        404: failed("No open session for this game.", "No active session found"),
      },
    },
  },
  "/play-session/recent": {
    get: {
      tags: ["Play sessions"],
      summary: "Recent sessions",
      security: bearerAuth,
      parameters: [queryParam("limit", "Clamped to 1–50.", { type: "integer", default: 10 })],
      responses: {
        200: ok("Sessions, newest first, with games populated.", { type: "array", items: ref("PlaySession") }),
        401: responses.unauthorized,
        500: failed("Lookup failed.", "Failed to fetch sessions"),
      },
    },
  },
  "/play-session/stats": {
    get: {
      tags: ["Play sessions"],
      summary: "Playtime totals",
      security: bearerAuth,
      responses: {
        200: ok("Aggregate playtime.", ref("PlaytimeStats")),
        401: responses.unauthorized,
        500: failed("Lookup failed.", "Failed to fetch playtime stats"),
      },
    },
  },
  "/play-session/game/{gameId}": {
    get: {
      tags: ["Play sessions"],
      summary: "Playtime for one game",
      security: bearerAuth,
      parameters: [libraryGameId()],
      responses: {
        200: ok("Playtime for the game.", ref("GamePlaytime")),
        400: invalidGameId,
        401: responses.unauthorized,
        500: failed("Lookup failed.", "Failed to fetch game playtime stats"),
      },
    },
  },
};

