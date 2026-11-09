# RoninArc roadmap

Current release: **1.0.1** (2026-11-08), on [GitHub releases](https://github.com/Aadhikrish23/RoninArc/releases).

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
- **Updates:** automatic, from GitHub releases.
- **Support:** problem reports zipped to the Desktop.
- **Settings:** redesigned as one column of rows.

### Cloud and phone
- **RoninArc Cloud:** on Render and MongoDB Atlas, with password reset email through Resend.
- **Sync:** offline-first, with merge-by-game, tombstones and "later change wins".
- **Android app:** library, game pages, collections, dashboard, add games, the assistant and settings.
- **Landing page:** download links that always point at the newest release.

## Next (agreed 2026-11-09)

### Bugs
1. **AI:** "move all my God of War games into the collection" left one game out.
2. **AI:** "add the Batman games, create a Batman collection and put them in it" didn't work properly.
3. **Mobile sign-in:** fails on the first try and works on the second. Likely the free-plan cloud waking up; find the cause, then add an automatic retry with a "waking up the server" message, or keep the server awake.

### Mobile Settings
4. **Redesign:** match the desktop's one-column Settings (rows instead of cards, same wording, only what applies to the phone).

### Getting the library onto the phone without hunting through Settings
5. **Phone hint:** when the library is empty, a card says "Your games are on your PC" with "Scan the code" and "Enter code".
6. **Link code:** the PC shows a 6-digit code. Typing it on the phone signs in and syncs, with no password.
7. **QR code:** the same as the link code, scanned from the PC, with the code as a fallback.
8. **PC prompt:** a one-time "Get your library on your phone" banner once the library has games, and a permanent "Connect your phone" item in Settings.
9. **Sign-in checkbox:** "Sync with my other devices", **ticked by default**, on desktop register and login.
   - It makes the same call as "Sync to cloud" in Settings.
   - Offline, it links the next time the PC is online.

### When the cloud username is taken
10. **Live check:** on the register screen, check whether the name is free in the cloud while the user types.
11. **Try signing in first:** if the name is taken, silently try signing in with the same username and password. If it works, it's the same person: merge and turn sync on.
12. **Someone else's name:**
    - The PC account keeps working, and sync shows "needs attention" in Settings plus a one-time notice.
    - The notice suggests free names (like `name-2`) or lets the user choose "It's mine" and enter that account's password.
13. **Link code hides the name:** linking by code or QR never asks for the cloud name. Settings shows "Syncing as …".
14. **Email sign-in:** sign in to the cloud with email as well as username.

## Later
- **Installer:** code-sign it to remove the "Windows protected your PC" warning.
- **Cloud plan:** move the cloud off the free plan once testers rely on it.
- **More stores:** GOG and other launcher imports.
- **Achievements:** if they fit the product.
- **Cleanup:** remove the unused `ai_v2` module, and retire the older Atlas backup mirror now that sync exists.
