# RoninArc architecture

This describes RoninArc as of version 1.0.4. For the endpoints themselves, see [api.md](api.md) and the live Swagger UI at `/api/docs`.

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
server.ts              connect to MongoDB, start the sync scheduler, listen
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
  sync/                cloud sync: link, auto-link, push, pull, tombstones, phone link codes, name checks, AI quota
  logs/                client log ingestion (POST /logs/client)
  ai/                  the AI assistant (see below)
```

`npm run build` empties `dist/` before compiling, so removed code never reaches the installer. Every setting the backend reads is listed in `backend/.env.example`.

Modules follow the same shape: routes, controller, service, Mongoose model. Every query is scoped to the signed-in user; another user's ids behave as not found.

### Authentication

- Passwords are hashed with bcrypt.
- Accounts sign in with their email (case-insensitive) and password; emails are unique per database (checked in code). `displayName` is what the apps show and isn't unique. `username` stays as an internal unique handle (generated from the email, never typed or shown) because the unique index, sync and links key on it.
- A PC account from before email sign-in (no email) can still sign in with its old name on that PC; `GET /auth/me` returns `needsEmail: true` and the app asks once per session for an email (`PATCH /auth/email`, password-confirmed; on a linked PC the cloud takes it first).
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
- **Linking a PC:** `POST /sync/link` creates the cloud account with the PC account's id and password hash (`mode: "create"`), or signs in to an existing cloud account and merges (`mode: "signin"`). Settings → RoninArc Cloud → "Sync to cloud" calls it.
- **"Sync with my other devices"** (desktop login and sign-up, ticked by default): after a local sign-in the UI calls `POST /sync/auto-link` in the background, which never blocks sign-in.
  - Offline, the choice is stored (`SyncIntent`) and the scheduler retries every minute.
  - If the email already has a cloud account, it silently tries the just-typed password on it. If that works it's the same person, so the libraries merge.
  - Otherwise `/sync/status` reports `autoLink.attention: "email-taken"`, and Settings shows "Sync needs your attention" ("Enter its password" for that cloud account, or "Not now").
  - An account with no email gets `attention: "needs-email"`; adding an email retries the link straight away.
  - Choosing "Stop syncing" or "Not now" makes the box start unticked from then on.
- **Linking a phone:** a linked PC asks the cloud for a 6-digit code (`POST /sync/phone-code` on the PC, `POST /sync/link-code` in the cloud). It shows it in "Connect your phone" (`ConnectPhoneModal`) as a QR code of `roninarc://link/<code>` with the digits under it and a countdown.
  - The phone scans it (`expo-camera`) or types it, and `POST /sync/link-code/claim` returns a session, so there's no password on the phone.
  - Codes are stored as an HMAC under the server secret in the `linkcodes` collection (TTL index). They last 10 minutes, work once, and there's one per account. Claims are limited to 10 per 15 minutes per network.
  - The phone sends `X-RoninArc-Client: phone` when signing in; the cloud records `phoneLinkedAt`, and the PC sees `phoneLinked` in `/sync/status` on its next pull.
  - The desktop dashboard shows a dismissible "Get your library on your phone" banner while the library has games and no phone is linked. Settings has a permanent "Your phone" row.
- **Signing in on a new PC:** when local sign-in fails, the PC tries the same details against the cloud (`signInThroughCloud`). If they work, it creates the local account with the cloud account's id, links it and pulls the library down.

### The AI assistant

`modules/ai/` is a domain-agnostic core with one domain pack, `domains/games/`.

1. **Pre-routing** (`pipeline/PreRoute.ts`): answers what needs no model (greetings, "what's in my collection", deleting or renaming a collection, undo, quick commands such as launch).
2. **Planning:** the model turns the message into intents (JSON). Providers: NVIDIA NIM (primary model plus fallbacks, `NVIDIA_*`) or Ollama (`OLLAMA_*`), chosen by `AI_PROVIDER`. `MOCK_LLM=true` swaps in a deterministic stand-in for tests.
3. **Corrections and grounding** (`PlanCorrections.ts`, `PlanGrounding.ts`, `SeriesCollection.ts`, ...): checks the plan against the user's own words. It drops changes nobody asked for, ties games to ones the user named (every word asked for must be in the title; one shared word isn't the same game), adds missing games before acting on them, and fills a collection with every owned game in a series ("all the X games") when the model leaves that step out. Steps can carry a game's library id, so two games with the same title (God of War 2005 and 2018) are both reached.
4. **Entity resolution and execution:** a name that fits two owned games equally well ("batman arkham" with Asylum and City owned) gets a "which one?" question. When one game in a request is unclear, the clear steps run first and only the unclear part waits for the answer (`pipeline/PlanRunner.ts`), so answering doesn't repeat them. Tools such as `AddGameTool`, `UpdateStatusTool`, `CreateReviewTool`, `AddToCollectionTool`, `LaunchGameTool`, `RecommendGamesTool`, `SearchGamesTool` and the Epic tools run in order. Adding a game runs first.
5. **Reply:** built from what actually happened, with optional follow-up offers ("Want me to add ... to it?") and an undo log.

Questions get a second, plain-text "answer mode" call with library facts and IGDB facts attached. Each request writes a trace log (prompt, the model's raw plan, planning, execution, reply) to `LOG_DIR/ai/<date>/`, so it survives reinstalls. Day folders older than 14 days are deleted, and the oldest go first past 150 MB (`AI_LOG_RETENTION_DAYS`, `AI_LOG_MAX_MB`).

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
- **Updates** (`services/updates.js`): electron-updater reading GitHub releases (`release.json`: `"github": { owner, repo }`; the older `updateUrl` generic feed still works). It checks shortly after start and every 4 hours, downloads in the background, and asks before restarting. From 1.0.2 on, installers have the version in their name, so an update downloads only the parts that changed (using the previous release's blockmap). 1.0.0 and 1.0.1 installs do one last full download.
- **Problem reports** (`services/diagnostics.js`): Settings → "Create problem report" zips `startup.log`, recent JSON logs and the 40 newest AI logs onto the Desktop, with tokens and keys removed.
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
  dashboard/    stats, playtime, activity, the "Get your library on your phone" banner
  recommendations/
  reviews/  notes/  playSession/  activity/
  providers/    Steam and Epic connect, resync, status
  ai/           the floating assistant and the full /ai page
  settings/     one-column Settings (account, game sources, cloud, your phone, appearance, security, support, delete), Connect your phone (QR + code), the sync attention flow
```

Routes: `/` library, `/library/browse`, `/library/game/:igdbId`, `/collections/:collectionId`, `/dashboard`, `/recommendations`, `/ai`, `/settings`, `/providers/epic/callback`, plus `/login` and `/signup`.

## Phone app

`mobile/src/`:

- `app/`: Expo Router screens.
  - Tabs: Library, Dashboard and Settings.
  - Other screens: game page, collection page, all games, add a game, the assistant, sign in, sign up, forgot password, `link-with-pc` (scan the PC's QR code or type its code when signed out) and `connect` (the same when signed in; it switches account).
  - Settings follows the desktop's one-column rows: Account, RoninArc Cloud ("Syncing as …", connected with a code or a password), Security, Delete account, then the app version and IGDB credit.
- `api/`: typed client; `schema.d.ts` is generated from the backend's OpenAPI document (`npm run api:types`).
- `auth/`: tokens in `expo-secure-store`.
- `data/`: TanStack Query hooks.

The phone app only talks to RoninArc Cloud, at the address baked in at build time (`RONINARC_CLOUD_URL`, see `app.config.ts`). A phone with an empty library shows "Your games are on your PC" with Scan code / Enter code / "No PC? Add a game here".

The free Render plan sleeps when idle, so the first request can take about a minute. Before signing in, the client waits on `/health` (up to about 100 seconds, riding out 502/503 while the server starts) and retries once, and the sign-in screens say "Waking up the server…" meanwhile.

## Releases

- Each GitHub release carries `RoninArc-Setup-<version>.exe`, its `.blockmap` and `latest.yml` for the updater, plus `RoninArc-Setup.exe` (a fixed-name copy) and `RoninArc.apk` for the landing page's `releases/latest/download/<file>` links.
- The landing page's version is the desktop version at build time, swapped for the newest GitHub release tag when the page loads.
- See [beta/RELEASING.md](beta/RELEASING.md).

## Security hardening (2026-11)

Changes made after a static security review (`issues/SECURITY-AND-ENGINEERING-FEEDBACK.md`):

- **Logs never hold secrets.** Provider sign-in responses are not logged. Console output is scrubbed of tokens, passwords, bearer headers and JWTs before it reaches the log files, and `console.dir` goes through the same scrubbing.
- **The PC's backend is for this machine only.** In the desktop app it listens on loopback (127.0.0.1 and ::1), not on every network interface. Browsers' cross-origin requests are accepted only from the app itself (`null` / `file://`) and from localhost pages; other websites are refused. Sign-in and sign-up are rate limited on a PC as well as in the cloud.
- **Sync checks ownership.** A pushed document may only point at the pusher's own documents: foreign ids are dropped from lists, and a document whose single reference is foreign is not taken. Every read that follows a reference (collections, activity, play sessions, the dashboard, AI answers) only returns the signed-in person's own documents. Timestamps a device claims are capped at five minutes ahead.
- **Accounts and tokens.** One account per email is enforced by a unique, case-insensitive database index (a duplicate sign-up race gets a 409). Refresh tokens are stored as SHA-256 hashes and are claimed atomically, so one token can be used once even under concurrent requests; tokens stored the old way keep working until they expire and are replaced by hashed ones. A password-reset link is claimed atomically. Passwords are used as typed and must be at least 8 characters for new accounts and changed passwords; older passwords still sign in.
- **AI confirmations.** A casual reply ("thanks", "cool", "fine") is never taken as a yes to removing a game.
- **Desktop sessions.** The renderer keeps its sign-in in one store (localStorage for "Remember me", else sessionStorage) and clears the other on sign-in.
- **Desktop app.** Every privileged call from the page (launching a game, the Epic and Steam sign-in windows, store pages, updates, problem reports) is accepted only from RoninArc's own page. A game launches only from an existing `.exe`, `.lnk` or `.url` path, or a `steam://` / `com.epicgames.launcher://` link; paths with shell characters are refused, and `.exe` files start without a shell. The sign-in windows open only the real Epic and Steam pages. The main window can't navigate away from the app, open extra windows or embed web views; web links open in the user's browser. The checks live in `desktop/services/ipcGuards.js`.
- **Downloaded database.** `desktop/scripts/fetch-mongod.js` can verify the MongoDB download against a pinned SHA-256 (`MONGO_ZIP_SHA256`); until a hash is pinned it prints a warning.
- **CI.** `.github/workflows/ci.yml` builds and type-checks each project, scans for secrets (gitleaks), reports `npm audit`, and runs the API tests on Windows (non-blocking until it has passed once).
