# RoninArc

RoninArc is a game library and backlog tracker for Windows PC gamers, with an Android companion app and an AI assistant you talk to in plain language.

- **One place for everything you own:** add games from IGDB, or import your whole Steam and Epic libraries.
- **Track your games:** statuses (Plan to Play, Playing, Paused, Completed, Dropped), 1–10 ratings and reviews, notes, collections, and a dashboard with playtime and activity.
- **Launch and time your games:** launch installed games straight from RoninArc, and play time is recorded until the game closes.
- **Recommendations:** what to play next from your backlog, and new games to discover, each with a reason.
- **The AI assistant changes your library:** "I finished celeste, 9/10", "make a soulslike collection and put ds3 in it", "create a God of War collection with all my God of War games", "what should I play tonight? I've got 2 hours", "undo that".
- **Offline-first:** everything except search, the AI and store imports works without internet, and your data stays on your PC.
- **Cloud sync and the phone app:** tick "Sync with my other devices" when you sign in (on by default), then scan a QR code or type a 6-digit code from the PC on your Android phone. No password on the phone, and the PC keeps working offline.

Current version: **1.0.2**. Downloads are on [GitHub releases](https://github.com/Aadhikrish23/RoninArc/releases/latest).

## Documentation

| | |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Product document |
| [docs/SRS.md](docs/SRS.md) | Software requirements specification |
| [docs/architecture.md](docs/architecture.md) | Architecture |
| [docs/api.md](docs/api.md) | API overview (live Swagger UI at `/api/docs`) |
| [docs/roadmap.md](docs/roadmap.md) | Roadmap |
| [docs/beta/START_HERE.md](docs/beta/START_HERE.md) | Guide for testers |
| [docs/beta/RELEASING.md](docs/beta/RELEASING.md) | Building and publishing a release |
| [docs/cloud/DEPLOY.md](docs/cloud/DEPLOY.md) | Deploying RoninArc Cloud |

## Tech stack

| Part | Built with |
|---|---|
| Backend | Node.js, Express 5, TypeScript, MongoDB with Mongoose 9, JWT auth, pino logs, Sentry (optional), Swagger UI |
| Desktop UI | React 19, Vite, Chakra UI v2, TanStack Query, React Router 7, framer-motion |
| Desktop app | Electron 39, electron-builder (NSIS installer), electron-updater, an embedded MongoDB |
| Phone app | Expo, React Native, Expo Router, TanStack Query |
| Landing page | React, Vite, deployed as a Render static site |
| AI | NVIDIA NIM models with fallbacks (Ollama for local development) |
| Game data | IGDB |
| Cloud | Render (backend), MongoDB Atlas, Resend (email) |
| API keys | keygate, a Cloudflare Worker key proxy (separate repository) |
| Tests | Playwright (API and UI projects) with mock IGDB, Resend and Sentry servers |

## Project structure

```
backend/     Express API: runs inside the desktop app (local mode) and as RoninArc Cloud (CLOUD_MODE=true)
frontend/    React UI for the desktop app
desktop/     Electron app: embedded MongoDB, backend process, game launcher, play tracker, updater
mobile/      Expo Android app (talks to RoninArc Cloud)
landing/     Marketing site with the download buttons
e2e/         Playwright API and UI tests
docs/        Documentation
render.yaml  Render Blueprint for RoninArc Cloud and the landing page
```

## Local development

You need Node.js 22 and a MongoDB server on `localhost:27017` for development. The packaged app brings its own MongoDB.

### Backend

```bash
cd backend
npm install
npm run dev          # http://localhost:5000, Swagger at /api/docs
```

`backend/.env` holds development settings and is never committed. Copy [`backend/.env.example`](backend/.env.example), which lists every setting the backend reads with a placeholder and a description. The main ones:

- **Database and auth:** `LOCAL_URL_Mongo` (or `MONGO_URI`), `JWT_SECRET`, `PORT`
- **CORS:** `ALLOWED_ORIGIN`, set to `http://localhost:5173` for the Vite dev server
- **Game data:**
  - straight to IGDB with `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`
  - or through keygate with `IGDB_BASE_URL` and `IGDB_API_KEY`
- **AI:**
  - `AI_PROVIDER` (`nvidia` or `ollama`)
  - `NVIDIA_API_KEY`, `NVIDIA_MODEL`, `NVIDIA_BASE_URL` and `NVIDIA_FALLBACK_MODELS`
  - or `OLLAMA_BASE_URL` and `OLLAMA_MODEL`
  - `MOCK_LLM=true` for a deterministic stand-in
- **Steam:** `STEAM_API_KEY`
- **Optional:**
  - `CLOUD_API_URL` (a cloud to sync with), `SENTRY_DSN`, `LOG_LEVEL`, `LOG_DIR`

### Desktop UI

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The UI works in a browser for development. Launching games, store sign-in windows and updates need the Electron app.

### Desktop app

With the backend and frontend dev servers running:

```bash
cd desktop
npm install
npm run dev
```

In development, Electron uses your dev servers. Only a packaged build starts its own MongoDB and backend.

### RoninArc Cloud locally

```bash
node backend/scripts/dev-cloud.cjs   # cloud mode on http://localhost:5056 with its own database
```

### Phone app

```bash
cd mobile
npm install
npx expo start
```

See [mobile/README.md](mobile/README.md) for the emulator, a real phone through Expo Go, and building the APK.

### Landing page

```bash
cd landing
npm install
npm run dev
```

### Tests

```bash
cd e2e
npm install
npx playwright install chromium
npm run test:api     # about 630 API tests
npm run test:ui      # UI tests in Chromium
```

The suite starts its own MongoDB, mock IGDB, Resend and Sentry servers, a local backend, a cloud backend and the frontend, so it doesn't touch your data.

## Building the Windows installer

```bash
cd desktop
npm run predist && npm run dist
```

`predist` downloads MongoDB, builds the backend (from a clean `dist/`) and the frontend, and copies the frontend in. `dist` never uploads anything (`--publish never`).

The output goes to `desktop/dist/`: `RoninArc-Setup-<version>.exe`, its `.blockmap` and `latest.yml`.

The build needs two gitignored files in `desktop/`, copied from their `.example.json` files:
- `keygate.json`, so the installed app can get its own API token
- `release.json`, with where updates come from (`"github": { "owner", "repo" }`) and the cloud address

## Releasing

Releases are published on GitHub with the GitHub CLI. Installed apps update themselves from the latest release, and the landing page's buttons always serve it. In short:

1. Bump `version` in `desktop/package.json` (and in `mobile/app.config.ts` with a higher `versionCode` if the APK changed).
2. Build the installer (and the APK), then commit and push.
3. Run `npm run stage-release` in `desktop/` (add `-- --apk <path>` for a new APK). It gathers `RoninArc-Setup-X.exe`, its blockmap, `latest.yml`, a fixed-name copy `RoninArc-Setup.exe` for the website, and `RoninArc.apk` into `release/vX/`, and prints the `gh release create` command to run.

The full steps are in [docs/beta/RELEASING.md](docs/beta/RELEASING.md).

## Author

Aadhi Narayanan
