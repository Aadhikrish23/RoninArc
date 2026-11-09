# RoninArc architecture

This describes RoninArc as of version 1.0.1. For the endpoints themselves, see [api.md](api.md) and the live Swagger UI at `/api/docs`.

## The pieces

RoninArc is one backend that runs in two places, plus three front ends and a key proxy.

| Piece | Folder | What it is | Runs on |
|---|---|---|---|
| Backend | `backend/` | Node.js + Express 5 + TypeScript + Mongoose 9 | Inside the desktop app (local mode) and on Render (cloud mode) |
| Desktop app | `desktop/` | Electron 39 shell: starts MongoDB and the backend, launches games, tracks play time, updates itself | The user's Windows PC |
| Desktop UI | `frontend/` | React 19 + Vite + Chakra UI v2 + TanStack Query + React Router 7 | Loaded by the desktop app (and a browser in development) |
| Phone app | `mobile/` | Expo (React Native) + Expo Router + TanStack Query | Android |
| Landing page | `landing/` | React + Vite static site with the download buttons | Render static site |
| keygate | separate repo (`E:\keygate`) | Cloudflare Worker that holds the real IGDB, NVIDIA and Steam keys | Cloudflare |
| Tests | `e2e/` | Playwright API and UI suites with mock IGDB, Resend and Sentry servers | Developer PC |

```
                         ┌──────────────────────────── Windows PC ────────────────────────────┐
                         │  Electron (desktop/main.js)                                          │
                         │   ├─ embedded mongod :27018  (data in %APPDATA%)                     │
  keygate (Cloudflare) ◄─┼── ├─ backend :5000  (local mode, same code as the cloud)             │
   IGDB / NVIDIA / Steam │   ├─ React UI (frontend/, loaded from disk)                         │
                         │   └─ game launcher, play-time tracker, Steam/Epic scanners, updater  │
                         └───────────────┬──────────────────────────────────────────────────────┘
                                         │ optional sync (push / pull)
                                         ▼
                         RoninArc Cloud on Render (backend, CLOUD_MODE=true) ── MongoDB Atlas
                                         ▲                      │
                                         │                      └── Resend (password reset email)
                         Android app (mobile/) ─────────────────┘
```

## Runtime modes

`backend/src/shared/runtimeMode.ts` decides the mode:

- **Local (default).** One PC, one embedded database, works offline. A local account can link to RoninArc Cloud and sync (`CLOUD_API_URL` set by the desktop app). Every successful write schedules a sync a few seconds later (`syncSoon` in `app.ts`).
- **Cloud (`CLOUD_MODE=true`).** Many users on MongoDB Atlas. Serves the phone app directly and PCs' sync. Adds rate limits on sign-in and sign-up, a per-person daily AI allowance (`AI_DAILY_LIMIT_PER_USER`, default 150), password reset emails through Resend, and "sign out everywhere" on password change.

Some routes only exist in one mode (for example `/sync/register`, `/sync/push`, `/sync/pull` in the cloud; `/sync/link`, `/sync/now`, `/sync/unlink` on a PC). The OpenAPI document is built for the mode the server runs in.

## Backend

`backend/src/`:

```
server.ts              connect to MongoDB, start sync scheduler, start optional Atlas mirror, listen
app.ts                 middleware, CORS, Swagger, rate limits, routers, error handler
instrument.ts          Sentry (only when SENTRY_DSN is set)
docs/openapi/          the OpenAPI 3.1 document, split by area
shared/                errors, logging (pino, JSON files with retention), rate limiter, runtime mode
modules/
  auth/                register, login, refresh, logout, logout-all, change/forgot/reset password, delete account
  library/             the user's games (LibraryGame), IGDB metadata enrichment
  igdb/                IGDB search and details, title matching
  dashboard/           stats and the dashboard overview
  review/              one 1-10 rating plus optional text per game
  notes/               free-text notes per game
  collection/          user-made groups of games
  activity/            the activity feed (adds, status changes, ratings, launches...)
  playSession/         play sessions and playtime totals
  recommendation/      "play next" from the library and "discover" from IGDB, dismissals
  providers/           Steam (OpenID + Web API) and Epic (OAuth + library API) import and resync
  sync/                cloud sync: link, push, pull, tombstones, AI quota
  backup/              older mirror of a PC's data to an Atlas database (Atlas_URL), and restore
  logs/                client log ingestion (POST /logs/client)
  ai/                  the AI assistant (see below)
  ai_v2/               an unfinished rewrite; not mounted in app.ts
```

Modules follow the same shape: routes, controller, service, Mongoose model. Every query is scoped to the signed-in user; another user's ids behave as not found.

### Authentication

- Passwords are hashed with bcrypt.
- `POST /auth/login` and `POST /auth/register` return a JWT access token (15 minutes) and a single-use refresh token (stored as `RefreshToken`). `POST /auth/refresh` swaps the refresh token for a new pair.
- "Remember me" on the desktop decides whether the refresh token is kept between launches.
- In the cloud, a password change or reset sets a cutoff so every token issued before it stops working (`tokenCutoff.ts`).
- Each desktop install generates its own `JWT_SECRET` on first launch, stored in the user's app data folder.

### Game data (IGDB)

- Search and details come from IGDB. On the desktop and in the cloud the calls go through keygate (`IGDB_BASE_URL` + `IGDB_API_KEY`); in development they can go straight to Twitch's IGDB API with `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`.
- Games carry an `igdbId`. Games added before the move from RAWG keep their old `rawgId`; the two numbers are never mixed.
- `metadataEnrichmentService` fills covers, summaries, genres, style tags, critic and community scores in batches (Steam id, exact name, edition-stripped name, alternative names, then one search each).

### Steam and Epic

- **Steam:** "Sign in through Steam" (OpenID, captured by the desktop app) gives the Steam id; the Steam Web API returns the full owned library. The desktop also scans local Steam libraries for installed games.
- **Epic:** OAuth sign-in in a desktop window; the Epic library API returns owned games. The desktop scans Epic's install manifests for installed games.
- `POST /provider/installations/refresh` records which owned games are installed on this PC and their launch paths.

### Cloud sync

`modules/sync/`:

- **What syncs:** games, collections, reviews, notes, play sessions, activities and recommendation feedback (`syncCollections.ts`). A game's `exePath` and store sign-ins never leave the PC.
- **Matching:** the same game added on two devices is matched by its natural key (`igdbId`, or `rawgId` for old games) and becomes one game.
- **Deletes:** recorded as tombstones so they propagate.
- **Conflicts:** the later change wins.
- **Schedule (PC):** every 60 seconds while linked, and about 4 seconds after any change. The first request to a sleeping free-plan cloud can take up to about 90 seconds.
- **Linking a PC:** `POST /sync/link` creates the cloud account with the PC account's id and password hash (`mode: "create"`), or signs in to an existing cloud account and merges (`mode: "signin"`). Today the user starts this from Settings → RoninArc Cloud.
- **Signing in on a new PC:** when local sign-in fails, the PC tries the same details against the cloud (`signInThroughCloud`). If they work, it creates the local account with the cloud account's id, links it and pulls the library down.

### The AI assistant

`modules/ai/` is a domain-agnostic core with one domain pack, `domains/games/`.

1. **Pre-routing** (`pipeline/PreRoute.ts`): answers what needs no model (greetings, "what's in my collection", deleting or renaming a collection, undo, quick commands such as launch).
2. **Planning:** the model turns the message into intents (JSON). Providers: NVIDIA NIM (primary model plus fallbacks, `NVIDIA_*`) or Ollama (`OLLAMA_*`), chosen by `AI_PROVIDER`. `MOCK_LLM=true` swaps in a deterministic stand-in for tests.
3. **Corrections and grounding** (`PlanCorrections.ts`, `PlanGrounding.ts`, `SeriesCollection.ts`, ...): checks the plan against the user's own words. It drops changes nobody asked for, ties games to ones the user named, adds missing games before acting on them, and fills a collection with "all the X games" when the model leaves that step out.
4. **Entity resolution and execution:** tools such as `AddGameTool`, `UpdateStatusTool`, `CreateReviewTool`, `AddToCollectionTool`, `LaunchGameTool`, `RecommendGamesTool`, `SearchGamesTool` and the Epic tools run in order. Adding a game runs first.
5. **Reply:** built from what actually happened, with optional follow-up offers ("Want me to add ... to it?") and an undo log.

Questions get a second, plain-text "answer mode" call with library facts and IGDB facts attached. Each request writes a trace log to `backend/logs/ai/<date>/` relative to the backend's install folder.

### Logging and errors

- Request log with an `X-Request-Id` on every response; JSON log files in `LOG_DIR` (on the desktop, `%APPDATA%\desktop\logs`) with retention (`LOG_RETENTION_DAYS`).
- 5xx errors go to Sentry when `SENTRY_DSN` is set.
- Error bodies: `{ Status, error }` for most routes, `{ Status: "Failed", Message }` for some older modules, `{ success: false, message }` for the AI.

## Desktop app

`desktop/main.js` and `desktop/services/`:

- **Single instance:** a second launch hands over to the running one, so two databases never open the same data folder.
- **Embedded database:** a bundled `mongod` on port 27018 with data in the user's app data folder (fetched at build time by `scripts/fetch-mongod.js`).
- **Backend:** started with Electron's own Node runtime (`ELECTRON_RUN_AS_NODE`) on port 5000, with the per-install JWT secret, `LOG_DIR`, keygate settings and `CLOUD_API_URL`.
- **keygate** (`services/keygate.js`): the installer ships no API keys. On first launch the app enrolls with keygate (using the build's `keygate.json`) and stores its own token in `keygate-token.json`.
- **Launching games:** from an `.exe` path or a `steam://` / Epic URI.
- **Play time** (`services/gameTracker.js`): after a launch, checks every 5 seconds whether a program from the game's folder is running. The session ends at the time the game was last seen.
- **Store pages** (`services/gamePage.js`): "Open in Steam / Epic" for owned games that aren't installed. Epic store slugs are looked up through Electron's network stack.
- **Scanners:** `steamScanner.js` and `epicScanner.js` find installed games.
- **Updates** (`services/updates.js`): electron-updater with a generic feed set by `release.json`'s `updateUrl` (the GitHub "latest release" download folder). It checks shortly after start and every 4 hours, downloads in the background, and asks before restarting.
- **Problem reports** (`services/diagnostics.js`): Settings → "Create problem report" zips `startup.log` and recent JSON logs onto the Desktop, with tokens and keys removed.
- **Startup log:** `startup.log` in the app data folder, for "won't start" reports.

## Desktop UI

`frontend/src/`:

```
app/            providers, router (AppRouter.tsx), layout, theme
shared/         API client (axios with token refresh), shared components and utilities
features/
  auth/         login, signup, AuthContext
  library/      library page, browse (search), game details page
  collections/  collection details
  dashboard/    stats, playtime, activity
  recommendations/
  reviews/  notes/  playSession/  activity/
  providers/    Steam and Epic connect, resync, status
  ai/           the floating assistant and the full /ai page
  settings/     one-column Settings (account, game sources, cloud, appearance, security, support, delete)
```

Routes: `/` library, `/library/browse`, `/library/game/:igdbId`, `/collections/:collectionId`, `/dashboard`, `/recommendations`, `/ai`, `/settings`, `/providers/epic/callback`, plus `/login` and `/signup`.

## Phone app

`mobile/src/`:

- `app/`: Expo Router screens.
  - Tabs: Library, Dashboard and Settings.
  - Other screens: game page, collection page, all games, add a game, the assistant, sign in, sign up and forgot password.
- `api/`: typed client; `schema.d.ts` is generated from the backend's OpenAPI document (`npm run api:types`).
- `auth/`: tokens in `expo-secure-store`.
- `data/`: TanStack Query hooks.

The phone app only talks to RoninArc Cloud, at the address baked in at build time (`RONINARC_CLOUD_URL`, see `app.config.ts`). It shows a library only after a PC has synced it, or after games are added on the phone.

## Releases

- Desktop releases are GitHub releases with fixed file names: `RoninArc-Setup.exe`, `RoninArc-Setup.exe.blockmap`, `latest.yml`, plus `RoninArc.apk`.
- The desktop updater and the landing page both use `https://github.com/Aadhikrish23/RoninArc/releases/latest/download/<file>`.
- See [beta/RELEASING.md](beta/RELEASING.md).
