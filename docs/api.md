# RoninArc API

The source of truth is the OpenAPI 3.1 document the backend serves:

- **Swagger UI:** `http://localhost:5000/api/docs` on a running backend (use **Authorize** to try signed-in calls)
- **Raw JSON:** `http://localhost:5000/api/docs.json`
- **Source:** `backend/src/docs/openapi/`

The e2e suite (`e2e/tests/api/openapi.spec.ts`) fails if a route exists without being documented, and checks responses against the documented schemas. This page is a readable overview only.

## Conventions

- **Auth:** send `Authorization: Bearer <accessToken>`. Access tokens last 15 minutes; refresh tokens are single-use.
- **Success:** `{ "Status": "Success", "Data": ... }` (or `Message`). `/dashboard/stats` and `/ai/chat` return their payload directly.
- **Errors:** `{ "Status": "Fail" | "Error", "error": "..." }` for most routes, `{ "Status": "Failed", "Message": "..." }` for reviews, notes, collections, play sessions, activity and backup, `{ "success": false, "message": "..." }` for the AI.
- **Ownership:** everything is scoped to the signed-in user. Someone else's id behaves as not found.
- **Request ids:** every response has an `X-Request-Id` header that also appears in the server logs.
- **Modes:** some routes exist only on a PC (local mode) or only on RoninArc Cloud (`CLOUD_MODE=true`). They're marked below.

## System

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/health` | none | Liveness check |
| GET | `/api/docs.json` | none | The OpenAPI document |
| GET | `/api/docs` | none | Swagger UI |
| POST | `/logs/client` | yes | Store client-side log entries |

## Auth

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/auth/register` | none | Create an account (rate limited in the cloud) |
| POST | `/auth/login` | none | Sign in, returns an access and refresh token (rate limited in the cloud) |
| POST | `/auth/refresh` | none | Swap a refresh token for a new pair |
| POST | `/auth/logout` | none | Sign out this device (revokes the refresh token) |
| POST | `/auth/logout-all` | yes | Sign out every device |
| GET | `/auth/me` | yes | The current user's profile |
| PATCH | `/auth/change-password` | yes | Change password |
| POST | `/auth/forgot-password` | none | Email a reset link (a PC passes this on to the cloud) |
| GET, POST | `/auth/reset-password` | none | Reset page and form (cloud only) |
| DELETE | `/auth/account` | yes | Delete the account and all its data |

## Library

| Method | Path | What it does |
|---|---|---|
| GET | `/game` | The user's games |
| POST | `/game/add` | Add a game (IGDB id, title, cover, tags, status) |
| GET | `/game/filter/search` | Filter the library by an exact field value |
| GET | `/game/{gameid}` | One game |
| PATCH | `/game/{gameid}` | Update status, tags or executable path |
| DELETE | `/game/{gameid}` | Remove a game |
| POST | `/game/{gameid}/enrich` | Fill in metadata from IGDB |

## IGDB

| Method | Path | What it does |
|---|---|---|
| GET | `/igdb/search?query=...` | Search IGDB, split into games you own and games you don't |
| GET | `/igdb/{igdbId}` | Full details: summary, screenshots, genres, scores, time to beat |

## Reviews, notes, collections

| Method | Path | What it does |
|---|---|---|
| GET | `/review/{gameId}` | The user's review of a game |
| PUT | `/review/{gameId}` | Create or update a review (`rating` 1–10, optional `reviewText`) |
| DELETE | `/review/{gameId}` | Delete a review |
| GET | `/notes/{gameId}` | Notes on a game |
| POST | `/notes/{gameId}` | Add a note |
| PATCH | `/notes/{noteId}` | Edit a note |
| DELETE | `/notes/{noteId}` | Delete a note |
| GET | `/collection` | List collections |
| POST | `/collection` | Create a collection |
| GET | `/collection/{collectionId}` | One collection with its games |
| PATCH | `/collection/{collectionId}` | Rename or re-describe it |
| DELETE | `/collection/{collectionId}` | Delete it (the games stay in the library) |
| POST | `/collection/{collectionId}/games` | Add a game |
| DELETE | `/collection/{collectionId}/games/{gameId}` | Remove a game |

## Dashboard, activity, play sessions

| Method | Path | What it does |
|---|---|---|
| GET | `/dashboard/stats` | Library statistics |
| GET | `/dashboard/overview` | Everything the dashboard page shows |
| GET | `/activity` | Recent activity, newest first |
| POST | `/activity/launch/{gameId}` | Record that a game was launched |
| POST | `/play-session/start/{gameId}` | Start a session (returns the open one if there is one) |
| POST | `/play-session/end/{gameId}` | End the open session; optional `endedAt` (when the game was last seen) |
| GET | `/play-session/recent` | Recent sessions (`limit` is clamped) |
| GET | `/play-session/stats` | Playtime totals and most played game |
| GET | `/play-session/game/{gameId}` | Playtime and last played for one game |

## Recommendations

| Method | Path | What it does |
|---|---|---|
| GET | `/recommendations` | "Play next" from the library and "discover" picks from IGDB, each with a reason |
| POST | `/recommendations/dismiss` | Hide a game from recommendations |
| DELETE | `/recommendations/dismiss/{igdbId}` | Undo a dismissal |

## AI assistant

| Method | Path | What it does |
|---|---|---|
| POST | `/ai/chat` | Send a message: `{ message, client?: { canLaunchGames } }`. Returns `{ success, status, message, ... }`, plus client actions such as launching a game and optional follow-up questions |
| POST | `/ai/reset` | Clear the conversation |

In the cloud each person has a daily message allowance. Past it, `/ai/chat` returns `status: "LIMITED"` with a plain message instead of calling the model.

## Steam and Epic

| Method | Path | What it does |
|---|---|---|
| GET | `/provider/{providerId}/status` | Connected or not, account name, game count, last sync |
| GET | `/provider/{providerId}/oauth/start` | The store sign-in URL |
| GET | `/provider/{providerId}/oauth/return` | Sign-in redirect landing page (no auth) |
| POST | `/provider/{providerId}/connect` | Connect and import the owned library |
| POST | `/provider/{providerId}/resync` | Import again |
| DELETE | `/provider/{providerId}/disconnect` | Disconnect |
| POST | `/provider/installations/refresh` | Record which games are installed on this PC |

`providerId` is `steam` or `epic`.

## Cloud sync

| Method | Path | Mode | What it does |
|---|---|---|---|
| GET | `/sync/status` | PC | Whether sync is available and linked, the cloud name, last sync, last error, whether it needs a fresh sign-in, and pending changes |
| POST | `/sync/link` | PC | Start syncing: `mode: "create"` (new cloud account from this PC's account) or `"signin"` (existing cloud account, libraries merged) |
| POST | `/sync/reconnect` | PC | Sign in to the cloud again after a password change |
| POST | `/sync/now` | PC | Sync now |
| POST | `/sync/unlink` | PC | Stop syncing (the library stays on the PC) |
| POST | `/sync/register` | Cloud | Create a cloud account for a PC's existing account, keeping its id and password hash |
| POST | `/sync/push` | Cloud | Receive a batch of changes from a PC |
| GET | `/sync/pull?since=...` | Cloud | Changes since a point in time |

## Backup (older Atlas mirror)

| Method | Path | What it does |
|---|---|---|
| POST | `/backup/push` | Copy the current user's data to the Atlas database in `Atlas_URL` now |
| POST | `/backup/restore` | Restore an account from that database (no token; takes the account's username and password) |

This predates cloud sync and only runs on a PC with `Atlas_URL` set.
