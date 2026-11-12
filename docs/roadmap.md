# RoninArc roadmap

Current release: **1.0.4**, on [GitHub releases](https://github.com/Aadhikrish23/RoninArc/releases).

## Done

### Foundations
- **Accounts:** auth with access and refresh tokens, "Remember me", sign out everywhere, change password, delete account.
- **App structure:** feature-based frontend, modular backend.
- **API docs:** OpenAPI 3.1 at `/api/docs`, kept complete by tests.
- **Logging:** structured logs with request ids, Sentry support.

### Library and tracking
- **Library:** statuses, filters and sorting, and a game page with IGDB details.
- **Notes and reviews:** a 1–10 rating with optional text per game, plus any number of notes.
- **Collections:** create, rename, delete, add and remove games.
- **Dashboard:** stats, playtime, activity feed and continue playing.
- **Play sessions:** started when a game is launched, ended when the game's own process closes.
- **Recommendations:** "play next" and "discover", with reasons and dismissals.
- **Game data:** moved from RAWG to IGDB, with batch metadata enrichment and style tags.

### Stores and launching
- **Steam:** "Sign in through Steam" plus the Web API for the full owned library.
- **Epic:** sign-in and library import.
- **Installed games:** found locally for both stores and launched from RoninArc.
- **Not installed:** "Open in Steam/Epic" for owned games.

### AI assistant
- **Actions:** plain-language control of the library, collections, reviews, notes, launching and recommendations.
- **Reliability:** grounding and correction checks against the user's own words, undo, follow-up offers, and answers to game questions.
- **Providers:** NVIDIA NIM with fallback models (Ollama for development), a per-person daily limit in the cloud.
- **Testing:** 24 playtest rounds, with every finding turned into a test.

### Desktop app
- **Self-contained Windows installer:** embedded MongoDB, no Node install needed, splash screen on a slow start.
- **Keys:** handled through keygate, with per-install tokens.
- **Updates:** automatic, from GitHub releases; from 1.0.2 on they download only what changed.
- **Support:** problem reports zipped to the Desktop, including the AI logs, which now live in the app-data log folder and survive reinstalls.
- **Settings:** redesigned as one column of rows.

### Cloud and phone
- **RoninArc Cloud:** on Render and MongoDB Atlas, with password reset email through Resend.
- **Sync:** offline-first, with merge-by-game, tombstones and "later change wins".
- **Android app:** library, game pages, collections, dashboard, add games, the assistant and settings.
- **Landing page:** download links that always point at the newest release.

### Done in 1.0.2 (agreed 2026-11-09)

**AI fixes**
- **Series collections:** "move all my God of War games into the collection" reaches every owned game in the series, including two games with the same title.
- **Batman request:** "add the Batman games, create a Batman collection and put them in it" works. One shared word ("City") no longer counts as owning the game.
- **Unclear games:** when one game is unclear, the clear steps run first and only that game is asked about. A name that fits two owned games equally well asks "which one?".

**Phone app**
- **Settings:** redesigned to match the desktop's one-column rows.
- **First sign-in:** no longer fails while the free-plan cloud wakes up. The app waits, says "Waking up the server…", and retries.

**Getting the library onto the phone**
- **Empty phone library:** a "Your games are on your PC" card with Scan code / Enter code.
- **Link code and QR code:** "Connect your phone" on the PC shows a 6-digit code and a QR code. The phone signs in with no password and no cloud name.
- **PC prompts:** a dismissible "Get your library on your phone" banner on the dashboard, and a permanent "Your phone" row in Settings.
- **Sign-in checkbox:** "Sync with my other devices", ticked by default, on desktop login and sign-up. Offline, it links once the PC is online.

**Housekeeping**
- **Website:** shows the current version.
- **Updates:** download only what changed (versioned installer names, GitHub update feed).
- **Old backup:** the Atlas backup mirror is removed now that sync exists.
- **Clean-up:**
  - removed the unused `ai_v2` module and the RAWG leftovers
  - added `backend/.env.example`
  - builds start from a clean `dist/`

### Done in 1.0.3 (2026-11-09)

- **Email sign-in only:** accounts sign in with email and password on the PC and the phone; names are display names and don't have to be unique. Old PC accounts without an email are asked to add one. An email that already has a cloud account links by its password (same person, libraries merge) or asks for it in Settings.

### Done in 1.0.4 (2026-11-12)

- **Security hardening** from a code review: no tokens or passwords in logs; the PC's backend only answers this PC; sync can't touch other accounts' data; one account per email, atomic refresh and reset tokens; passwords need 8 characters; casual replies like "thanks" no longer confirm removing a game; the desktop app validates game launches and sign-in windows. A GitHub workflow builds and scans every push. See the Security hardening section in [architecture.md](architecture.md).
- **Fixed:** an expired session now returns to the login page in the installed app.

## Next

- **Link-code guessing:** add a global limit on link-code claims across networks, or a longer code.
- **Phone account switching:** revoke a phone's old refresh token when it switches account with a code.
- **APK signing:** sign the APK with a release keystore before sharing it widely.

## Later
- **Installer:** code-sign it to remove the "Windows protected your PC" warning.
- **Cloud plan:** move the cloud off the free plan once testers rely on it, so the first request doesn't wait for it to wake up.
- **More stores:** GOG and other launcher imports.
- **Achievements:** if they fit the product.
