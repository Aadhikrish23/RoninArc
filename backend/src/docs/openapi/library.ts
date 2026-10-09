import {
  appError,
  bearerAuth,
  dateTime,
  jsonBody,
  nullable,
  objectId,
  ok,
  pathParam,
  queryParam,
  ref,
  responses,
  type Schema,
} from "./common";

const providerLink: Schema = {
  type: "object",
  description: "How the game is linked to a store account (Steam/Epic).",
  properties: {
    providerGameId: { type: "string" },
    providerTitle: { type: "string" },
    owned: { type: "boolean" },
    installed: { type: "boolean" },
    installPath: { type: "string" },
    executable: { type: "string" },
    launcher: { type: "string" },
    manifestId: { type: ["string", "number"] },
    syncedAt: dateTime,
  },
};

export const librarySchemas: Record<string, Schema> = {
  LibraryGame: {
    type: "object",
    description: "A game in the user's library.",
    required: ["_id", "userId", "title", "progressStatus"],
    properties: {
      _id: objectId,
      userId: objectId,
      rawgId: { type: ["integer", "null"], description: "RAWG id. `null` for store imports (e.g. Steam) until metadata is matched.", example: 274755 },
      title: { type: "string", example: "Hades" },
      description: { type: "string" },
      tags: { type: "array", items: { type: "string" }, description: "Genres (from RAWG) and user tags.", example: ["Action", "RPG"] },
      imageURL: { type: "string", description: "Cover art URL for the selected artwork source (virtual)." },
      artwork: {
        type: "object",
        properties: {
          selectedSource: { type: "string", enum: ["manual", "rawg", "epic", "steam", "gog", "ea", "ubisoft", "xbox"] },
          sources: { type: "object", additionalProperties: { type: "string" } },
        },
      },
      progressStatus: ref("ProgressStatus"),
      exePath: { type: "string", description: "Path to a local executable, for manually added games." },
      developer: { type: "string" },
      developers: { type: "array", items: { type: "string" } },
      publishers: { type: "array", items: { type: "string" } },
      provider: { type: "string", enum: ["manual", "epic", "steam", "gog", "ea", "ubisoft", "xbox"] },
      providerGameId: { type: "string" },
      providerTitle: { type: "string" },
      normalizedTitle: { type: "string" },
      providers: { type: "object", additionalProperties: providerLink, description: "Keyed by provider id (`steam`, `epic`)." },
      screenshots: { type: "array", items: { type: "string" } },
      trailers: { type: "array", items: { type: "string" } },
      rawgRating: { type: "number", description: "RAWG community rating out of 5." },
      metacritic: nullable({ type: "number" }),
      website: { type: "string" },
      playtime: { type: "number", description: "Average playtime in hours (RAWG)." },
      metadataState: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["none", "pending", "enriching", "complete", "failed"] },
          lastAttempt: dateTime,
          lastSuccess: dateTime,
          lastError: { type: "string" },
        },
      },
      createdAt: dateTime,
      updatedAt: dateTime,
    },
  },
  LibraryGameWithRating: {
    allOf: [
      ref("LibraryGame"),
      {
        type: "object",
        required: ["rating"],
        properties: { rating: nullable({ type: "integer", minimum: 1, maximum: 10, description: "The user's review rating, if any." }) },
      },
    ],
  },
  AddGameRequest: {
    type: "object",
    required: ["rawgId", "title", "tags"],
    properties: {
      rawgId: { type: "integer", description: "RAWG id. A user can own each RAWG id once." },
      title: { type: "string", minLength: 1 },
      tags: { type: "array", items: { type: "string" } },
      description: { type: "string" },
      imageURL: { type: "string" },
      exePath: { type: "string" },
      progressStatus: { allOf: [ref("ProgressStatus")], default: "plan" },
    },
  },
  UpdateGameRequest: {
    type: "object",
    description: "Any subset of these fields. Setting the same status again is a no-op.",
    properties: {
      progressStatus: ref("ProgressStatus"),
      tags: { type: "array", items: { type: "string" } },
      exePath: { type: "string" },
    },
  },
  RawgSearchResult: {
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "integer", example: 9767 },
      name: { type: "string", example: "Hollow Knight" },
      imageURL: nullable({ type: "string" }),
      rating: { type: "number" },
      released: nullable({ type: "string" }),
      genres: { type: "array", items: { type: "string" } },
      added: { type: "integer" },
      ratingsCount: { type: "integer" },
      suggestionsCount: { type: "integer" },
      metacritic: nullable({ type: "number" }),
    },
  },
  RawgSearchResponse: {
    type: "object",
    required: ["owned", "discover", "totalOwned", "totalDiscover"],
    properties: {
      owned: { type: "array", items: ref("LibraryGame"), description: "Library games whose title matches the query." },
      discover: { type: "array", items: ref("RawgSearchResult"), description: "RAWG results the user doesn't own." },
      totalOwned: { type: "integer" },
      totalDiscover: { type: "integer" },
    },
  },
  RawgGameDetails: {
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      description: nullable({ type: "string" }),
      imageURL: nullable({ type: "string" }),
      imageAlt: nullable({ type: "string" }),
      screenshots: { type: "array", items: { type: "string" } },
      trailers: { type: "array", items: { type: "string" } },
      rating: { type: "number" },
      ratingsCount: { type: "integer" },
      released: nullable({ type: "string" }),
      website: nullable({ type: "string" }),
      metacritic: nullable({ type: "number" }),
      playtime: { type: "number" },
      genres: { type: "array", items: { type: "string" } },
      platforms: { type: "array", items: { type: "string" } },
      developers: { type: "array", items: { type: "string" } },
      publishers: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
    },
  },
  DashboardStats: {
    type: "object",
    description: "Not wrapped in `{ Status, Data }`.",
    required: ["totalGames", "owned", "installed", "playing", "completed", "continuePlaying", "recentGames", "genreStats", "statusStats"],
    properties: {
      totalGames: { type: "integer" },
      owned: { type: "integer", description: "Games linked to a store account." },
      installed: { type: "integer", description: "Store games currently installed." },
      playing: { type: "integer" },
      completed: { type: "integer" },
      continuePlaying: { type: "array", maxItems: 5, items: ref("LibraryGame") },
      recentGames: { type: "array", maxItems: 5, items: ref("LibraryGame"), description: "Newest first." },
      genreStats: {
        type: "array",
        maxItems: 8,
        items: { type: "object", required: ["genre", "count"], properties: { genre: { type: "string" }, count: { type: "integer" } } },
      },
      statusStats: {
        type: "array",
        items: { type: "object", required: ["status", "count"], properties: { status: { type: "string" }, count: { type: "integer" } } },
      },
    },
  },
  DashboardGameSummary: {
    type: "object",
    description: "The few game fields a dashboard row needs to show and link to a game.",
    additionalProperties: false,
    required: ["_id", "title", "imageURL", "rawgId", "progressStatus"],
    properties: {
      _id: objectId,
      title: { type: "string", example: "Hades" },
      imageURL: nullable({ type: "string" }),
      rawgId: { type: ["integer", "null"], description: "Null for games imported without a RAWG match." },
      progressStatus: { type: "string", enum: ["none", "plan", "playing", "paused", "completed", "dropped"] },
    },
  },
  DashboardOverview: {
    type: "object",
    additionalProperties: false,
    required: ["continuePlaying", "playtime", "backlog", "recentActivity"],
    properties: {
      continuePlaying: {
        type: "array",
        maxItems: 6,
        description: "Games marked Playing, most recently played first (never-played last).",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["game", "lastPlayed", "minutesPlayed"],
          properties: {
            game: ref("DashboardGameSummary"),
            lastPlayed: nullable(dateTime),
            minutesPlayed: { type: "integer", minimum: 0 },
          },
        },
      },
      playtime: {
        type: "object",
        additionalProperties: false,
        description: "From recorded play sessions (desktop launches). Open sessions count as 0 minutes until they end.",
        required: ["last7DaysMinutes", "last30DaysMinutes", "totalMinutes", "sessionsLast7Days", "daily", "mostPlayed"],
        properties: {
          last7DaysMinutes: { type: "integer", minimum: 0 },
          last30DaysMinutes: { type: "integer", minimum: 0 },
          totalMinutes: { type: "integer", minimum: 0 },
          sessionsLast7Days: { type: "integer", minimum: 0 },
          daily: {
            type: "array",
            minItems: 7,
            maxItems: 7,
            description: "The last 7 days, oldest first, ending today (server-local dates).",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["date", "minutes"],
              properties: { date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", example: "2026-10-09" }, minutes: { type: "integer", minimum: 0 } },
            },
          },
          mostPlayed: {
            type: "array",
            maxItems: 5,
            description: "All-time, games with at least one minute played.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["game", "minutesPlayed"],
              properties: { game: ref("DashboardGameSummary"), minutesPlayed: { type: "integer", minimum: 1 } },
            },
          },
        },
      },
      backlog: {
        type: "object",
        additionalProperties: false,
        required: ["total", "byStatus", "completedThisYear", "untouchedCount", "untouched"],
        properties: {
          total: { type: "integer", minimum: 0 },
          byStatus: {
            type: "object",
            additionalProperties: false,
            required: ["none", "plan", "playing", "paused", "completed", "dropped"],
            properties: Object.fromEntries(["none", "plan", "playing", "paused", "completed", "dropped"].map((s) => [s, { type: "integer", minimum: 0 }])),
          },
          completedThisYear: { type: "integer", minimum: 0, description: "Games marked Completed since 1 January that are still Completed." },
          untouchedCount: { type: "integer", minimum: 0, description: "Planned or unstarted games with no play session." },
          untouched: {
            type: "array",
            maxItems: 5,
            description: "The longest-waiting of those, oldest first.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["game", "addedAt"],
              properties: { game: ref("DashboardGameSummary"), addedAt: dateTime },
            },
          },
        },
      },
      recentActivity: {
        type: "array",
        maxItems: 10,
        description: "Newest first.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["_id", "type", "message", "createdAt", "game"],
          properties: {
            _id: objectId,
            type: { type: "string", example: "STATUS_CHANGED" },
            message: { type: "string", example: "Hades marked as completed" },
            createdAt: dateTime,
            game: { ...nullable(ref("DashboardGameSummary")), description: "Null when the activity isn't about a game or the game was removed." },
          },
        },
      },
    },
  },
};

const gameId = pathParam("gameid", "Library game id.", objectId);
const libTags = ["Library"];

export const libraryPaths = {
  "/game": {
    get: {
      tags: libTags,
      summary: "List the user's library",
      description: "Every game, with the user's review rating merged in (`rating`, null when unrated).",
      security: bearerAuth,
      responses: { 200: ok("The library.", { type: "array", items: ref("LibraryGameWithRating") }), 401: responses.unauthorized },
    },
  },
  "/game/add": {
    post: {
      tags: libTags,
      summary: "Add a game",
      security: bearerAuth,
      requestBody: jsonBody(ref("AddGameRequest"), { rawgId: 274755, title: "Hades", tags: ["Action", "RPG"], progressStatus: "plan" }),
      responses: {
        201: ok("Game added. A GAME_ADDED activity is recorded.", ref("LibraryGame")),
        400: appError(
          "Validation failed, or the game is already in the library.",
          "Valid rawgId is required",
          "Title is required",
          "Invalid Tags",
          "Invalid status",
          "Game already exists",
        ),
        401: responses.unauthorized,
      },
    },
  },
  "/game/filter/search": {
    get: {
      tags: libTags,
      summary: "Filter the library by an exact field value",
      security: bearerAuth,
      parameters: [
        queryParam("param", "Field to match. `status` is an alias of `progressStatus`.", { type: "string", enum: ["title", "tags", "progressStatus", "status"] }, true),
        queryParam("value", "Exact value (a tag matches any element of `tags`).", { type: "string", minLength: 1 }, true),
      ],
      responses: {
        200: ok("Matching games (possibly empty).", { type: "array", items: ref("LibraryGame") }),
        400: appError("Missing or invalid parameters.", "Missing search param", "Missing search value", "Invalid Search params", "Invalid Search value"),
        401: responses.unauthorized,
      },
    },
  },
  "/game/{gameid}": {
    get: {
      tags: libTags,
      summary: "Get one library game",
      security: bearerAuth,
      parameters: [gameId],
      responses: {
        200: ok("The game.", ref("LibraryGame")),
        400: appError("Malformed id.", "Invalid game id"),
        401: responses.unauthorized,
        404: appError("Not in this user's library.", "no value found"),
      },
    },
    patch: {
      tags: libTags,
      summary: "Update status, tags or executable path",
      description: "A status change records a STATUS_CHANGED activity.",
      security: bearerAuth,
      parameters: [gameId],
      requestBody: jsonBody(ref("UpdateGameRequest"), { progressStatus: "completed" }),
      responses: {
        200: ok("The updated game.", ref("LibraryGame")),
        400: appError("Malformed id or invalid fields.", "Invalid game id", "Invalid status", "Invalid Tags"),
        401: responses.unauthorized,
        404: appError("Not in this user's library.", "no value found"),
      },
    },
    delete: {
      tags: libTags,
      summary: "Remove a game",
      description: "Also removes it from collections and deletes its review and notes.",
      security: bearerAuth,
      parameters: [gameId],
      responses: {
        200: ok("The removed game.", ref("LibraryGame")),
        400: appError("Malformed id.", "invalid game id"),
        401: responses.unauthorized,
        404: appError("Not in this user's library.", "no value found"),
      },
    },
  },
  "/game/{gameid}/enrich": {
    post: {
      tags: libTags,
      summary: "Fill in metadata from RAWG",
      description:
        "Finds the best RAWG match by title and stores rating, screenshots, developers, etc. `metadataState.status` becomes `complete`, or `failed` when no plausible match exists.",
      security: bearerAuth,
      parameters: [gameId],
      responses: {
        200: ok("The game after the attempt.", ref("LibraryGame")),
        400: appError("Malformed id.", "Invalid game id"),
        401: responses.unauthorized,
        404: appError("Not in this user's library.", "Game not found"),
      },
    },
  },
  "/rawg/search": {
    get: {
      tags: ["RAWG"],
      summary: "Search RAWG, split into owned vs. discoverable",
      security: bearerAuth,
      parameters: [
        queryParam("query", "Search text.", { type: "string", minLength: 1 }, true),
        queryParam("page", "1-based page; invalid values fall back to 1.", { type: "integer", minimum: 1, default: 1 }),
      ],
      responses: {
        200: ok("Search results.", ref("RawgSearchResponse")),
        400: appError("Empty query.", "Search query is required"),
        401: responses.unauthorized,
        500: appError("RAWG isn't configured on this server.", "RAWG API is not configured"),
        502: appError("RAWG is unreachable or errored.", "Failed to fetch RAWG data"),
      },
    },
  },
  "/rawg/{rawgId}": {
    get: {
      tags: ["RAWG"],
      summary: "Full RAWG details for a game",
      security: bearerAuth,
      parameters: [pathParam("rawgId", "RAWG game id.", { type: "string", pattern: "^\\d+$" })],
      responses: {
        200: ok("Game details.", ref("RawgGameDetails")),
        401: responses.unauthorized,
        404: appError("Unknown RAWG id.", "RAWG game not found"),
        500: appError("RAWG isn't configured on this server.", "RAWG API is not configured"),
      },
    },
  },
  "/dashboard/overview": {
    get: {
      tags: ["Dashboard"],
      summary: "Everything the dashboard page shows",
      description:
        "Continue playing (with last played and hours), playtime over the last 7/30 days with a daily breakdown and most-played games, backlog progress, and the 10 most recent activities.",
      security: bearerAuth,
      responses: {
        200: ok("The overview.", ref("DashboardOverview")),
        401: responses.unauthorized,
        500: responses.internal,
      },
    },
  },
  "/dashboard/stats": {
    get: {
      tags: ["Dashboard"],
      summary: "Library statistics for the dashboard",
      security: bearerAuth,
      responses: {
        200: { description: "Statistics (unwrapped).", content: { "application/json": { schema: ref("DashboardStats") } } },
        401: responses.unauthorized,
        500: {
          description: "Failed to compute stats.",
          content: { "application/json": { schema: { type: "object", properties: { message: { type: "string" } } } } },
        },
      },
    },
  },
};
