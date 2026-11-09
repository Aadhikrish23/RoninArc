# RoninArc API

The source of truth is the OpenAPI 3.1 document the backend serves:

- **Swagger UI:** `http://localhost:5000/api/docs` on a running backend (use **Authorize** to try signed-in calls)
- **Raw JSON:** `http://localhost:5000/api/docs.json`
- **Source:** `backend/src/docs/openapi/`

The e2e suite (`e2e/tests/api/openapi.spec.ts`) fails if a route exists without being documented, and checks responses against the documented schemas. This page is a readable overview only.

## Conventions

- **Auth:** send `Authorization: Bearer <accessToken>`. Access tokens last 15 minutes; refresh tokens are single-use.
- **Success:** `{ "Status": "Success", "Data": ... }` (or `Message`). `/dashboard/stats` and `/ai/chat` return their payload directly.
- **Errors:** `{ "Status": "Fail" | "Error", "error": "..." }` for most routes, `{ "Status": "Failed", "Message": "..." }` for reviews, notes, collections, play sessions and activity, `{ "success": false, "message": "..." }` for the AI.
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
| POST | `/auth/register` | none | Create an account: `displayName`, `email`, `password` (rate limited in the cloud). Names don't have to be unique; emails do |
| POST | `/auth/login` | none | Sign in with `email` and `password`; returns an access and refresh token (rate limited in the cloud). A name instead of an email gets 400. The phone app sends `X-RoninArc-Client: phone`, so a linked PC learns a phone uses the account |
| PATCH | `/auth/email` | yes | Add an email to an account made before email sign-in (password-confirmed, rate limited) |
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

| Method | Path | Mode | Auth | What it does |
|---|---|---|---|---|
| GET | `/sync/status` | PC | yes | Whether sync is available and linked, the cloud name, last sync, last error, whether it needs a fresh sign-in, pending changes, `cloudEmail` ("Syncing as ..."), `phoneLinked` (a phone uses this account) and `autoLink` (`waiting`, `attention`: `email-taken`, `needs-email` or `failed`, `message`) |
| POST | `/sync/link` | PC | yes | Start syncing: `mode: "create"` (new cloud account from this PC's account) or `"signin"` with `email` and `password` (existing cloud account, libraries merged) |
| POST | `/sync/auto-link` | PC | yes | "Sync with my other devices" at sign-in. Links like `create` but never fails: offline it waits and retries every minute; if the email already has a cloud account it tries the just-typed password on it (merging, since it's the same person); otherwise the status says it needs attention (`email-taken` or `needs-email`). Returns `result`: `linked`, `waiting`, `needs-attention` or `unavailable` |
| DELETE | `/sync/auto-link` | PC | yes | Stop waiting to link ("Not now") |
| POST | `/sync/phone-code` | PC | yes | Link the PC first if needed, then ask the cloud for a phone link code (shown with a QR code) |
| POST | `/sync/reconnect` | PC | yes | Sign in to the cloud again after a password change |
| POST | `/sync/now` | PC | yes | Sync now |
| POST | `/sync/unlink` | PC | yes | Stop syncing (the library stays on the PC) |
| POST | `/sync/register` | Cloud | none | Create a cloud account for a PC's existing account, keeping its id and password hash (rate limited) |
| POST | `/sync/link-code` | Cloud | yes | A new 6-digit code for this account; any older one stops working. Stored as an HMAC, lasts 10 minutes, rate limited per account |
| POST | `/sync/link-code/claim` | Cloud | none | A phone trades a code (`"482913"`, `"482 913"` or `roninarc://link/482913`) for a session. Works once; 10 tries per 15 minutes per network |
| POST | `/sync/push` | Cloud | yes | Receive a batch of changes from a PC |
| GET | `/sync/pull?since=...` | Cloud | yes | Changes since a point in time |
