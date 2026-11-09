# RoninArc software requirements specification

Version 1.0.2. This describes what the system does today. Planned work is listed separately at the end and in the [roadmap](roadmap.md).

## 1. Introduction

### 1.1 Purpose

This document states the functional and non-functional requirements of RoninArc: the Windows desktop app, the Android app, RoninArc Cloud and the landing page. It's for anyone changing the code and for checking that a change keeps existing behaviour.

### 1.2 Scope

RoninArc lets a person:
- keep one library of the games they own
- track progress, ratings, reviews, notes, collections and playtime
- import owned games from Steam and Epic
- launch installed games
- get recommendations
- do all of this by talking to an AI assistant
- optionally sync the library to the cloud and an Android phone

### 1.3 Definitions

| Term | Meaning |
|---|---|
| Local mode | The backend inside the desktop app, one user's PC, embedded database |
| Cloud mode | The backend on Render with `CLOUD_MODE=true`, shared by all cloud users |
| Linked PC | A PC whose local account syncs with a cloud account |
| IGDB | The Internet Game Database, the source of game metadata |
| keygate | The Cloudflare Worker proxy that holds API keys and enforces per-token limits |
| Link code | A 6-digit, single-use, 10-minute code a linked PC shows (also as a QR code) that signs a phone in to the same cloud account |
| Intent | One action the AI planned from a message, for example `SetStatus` or `OrganizeCollection` |
| Status | One of Plan to Play, Playing, Paused, Completed, Dropped (or none) |

### 1.4 References

- [Architecture](architecture.md)
- [API overview](api.md) and the OpenAPI document at `/api/docs.json`
- [Product document](PRODUCT.md)

## 2. Overall description

### 2.1 Actors

- **Player:** the person using RoninArc on a PC, a phone, or both.
- **Tester:** a player on the beta who also sends problem reports.
- **Maintainer:** builds, releases and deploys.
- **External systems:**
  - IGDB, the NVIDIA NIM AI models (or Ollama in development), Steam (OpenID and Web API) and Epic (OAuth and library API)
  - Resend (email), MongoDB Atlas, Render, Cloudflare (keygate) and GitHub Releases

### 2.2 Operating environment

- **Desktop:** Windows 10 or 11 (x64). Electron 39 with a bundled MongoDB and Node runtime; the user installs nothing else.
- **Phone:** Android, sideloaded APK.
- **Cloud:** Node 22 on Render, MongoDB Atlas.

### 2.3 Constraints

- The desktop installer contains no API keys. Online features need a keygate token, obtained on first launch.
- The desktop app must keep working with no internet.
- The installer isn't code-signed yet.
- The cloud runs as a single instance, so rate limiting is in memory.

### 2.4 Assumptions

- One person per desktop install (one local account per PC is typical, though more are allowed).
- Steam libraries are visible through the Web API only when the user's game details are public or the API key has access.

## 3. Functional requirements

### 3.1 Accounts and sessions

- **FR-1.1** A player can register and sign in with a username and password. Sign-in also accepts the account's email instead of the username (case-insensitive), on the PC's cloud sign-in and on the phone.
  - Usernames are at least 3 characters and stored in lower case.
  - Passwords are at least 6 characters.
  - On a PC the email is optional and never used. In the cloud a valid, unique email is required, because it's how a forgotten password is reset.
  - A repeated sign-up within 10 minutes with the same password signs the player in instead of failing.
- **FR-1.1a** On a PC, when local sign-in fails, the PC tries the same details against RoninArc Cloud.
  - **New PC (or an account made on the phone):** a local account is created with the cloud account's id, the PC is linked, and the library comes down.
  - **After a password reset in the cloud:** the new password works on the PC.
- **FR-1.2** Sign-in returns a 15-minute access token and a single-use refresh token. The client refreshes silently.
- **FR-1.3** "Remember me" keeps the player signed in between desktop launches.
- **FR-1.4** A player can change their password, sign out this device, and sign out every device.
- **FR-1.5** In the cloud, changing or resetting a password invalidates all earlier tokens.
- **FR-1.6** A player can request a password reset email. A PC passes the request to the cloud, and the reset page is served by the cloud.
- **FR-1.7** A player can delete their account. Every game, review, note, collection, session, activity and dismissal of theirs is deleted with it.
- **FR-1.8** In the cloud, sign-in is limited to 30 attempts per 15 minutes and sign-up to 10 per hour, per network.

### 3.2 Library

- **FR-2.1** A player can search IGDB. Results are split into games already owned and games not owned.
- **FR-2.2** A player can add a game. It starts as Plan to Play unless a status is given.
- **FR-2.3** A player can set a game's status, tags and executable path, and remove the game.
- **FR-2.4** The library can be filtered and sorted. The game page shows IGDB details (summary, screenshots, genres, critic and community scores, time to beat).
- **FR-2.5** Metadata missing on a game is filled from IGDB on request and in batches after imports.
- **FR-2.6** A game is identified by `igdbId`. Games from before the IGDB move keep `rawgId`, and the two are never interchanged.

### 3.3 Reviews and notes

- **FR-3.1** A player can give a game one rating from 1 to 10 with optional text, and edit or delete it.
- **FR-3.2** A player can add, edit and delete any number of notes on a game.

### 3.4 Collections

- **FR-4.1** A player can create, rename, describe and delete collections. Collection names are unique per player.
- **FR-4.2** A player can add games to and remove games from a collection. Deleting a collection never removes its games from the library.

### 3.5 Dashboard and activity

- **FR-5.1** The dashboard shows totals by status, rating statistics, playtime, most played game, recent games and continue playing.
- **FR-5.2** Adds, status changes, ratings, collection changes and launches are recorded in an activity feed.

### 3.6 Play sessions

- **FR-6.1** Launching a game from the desktop starts a play session. Starting twice returns the open session.
- **FR-6.2** The desktop watches the game's own folder for running programs. It ends the session when the game is gone for two checks in a row, recording the time it was last seen.
- **FR-6.3** An `endedAt` before the start is moved to the start, and one in the future is moved to now. A malformed one is rejected.
- **FR-6.4** A game that never starts stops being watched after 10 minutes.

### 3.7 Recommendations

- **FR-7.1** The system recommends owned games to play next and unowned IGDB games to discover, based on the player's ratings, statuses, genres and style tags. Each pick comes with a reason.
- **FR-7.2** A player can dismiss a recommendation and undo the dismissal.

### 3.8 Steam and Epic

- **FR-8.1** A player can connect Steam through "Sign in through Steam". The full owned library is imported.
- **FR-8.2** A player can connect Epic through Epic sign-in. Owned games are imported.
- **FR-8.3** A player can resync or disconnect either store.
- **FR-8.4** The desktop finds installed Steam and Epic games and marks them launchable.
- **FR-8.5** For an owned game that isn't installed, the desktop opens its page in the Steam or Epic app.

### 3.9 Launching (desktop)

- **FR-9.1** The desktop launches a game from its executable path or through a Steam/Epic URI.
- **FR-9.2** In a browser (no desktop app), launch requests explain that launching needs the desktop app.

### 3.10 AI assistant

- **FR-10.1** A player can send a message in plain language. The assistant plans one or more actions and runs them in the order the player said them. Adding a game always runs before acting on it.
- **FR-10.2** Supported actions:
  - add or remove a game; set a status; complete a game
  - rate or review, or delete a review; add a note
  - create a collection; add to or remove from a collection; delete or rename a collection
  - launch a game; search the library; answer questions about the library
  - recommend games
  - connect, disconnect or sync Epic
  - undo the last change
- **FR-10.3** The assistant only changes games the player named or clearly referred to ("it", "that one", the game page they're on). Changes nobody asked for are dropped, and the reply says so.
- **FR-10.4** A request for "all the X games" in a collection adds every owned game in that series, even when the model leaves that step out, including two owned games with the same title (steps carry the game's library id).
- **FR-10.4a** A name matches an owned game only if every word asked for is in its title (small typos allowed) or the titles match closely overall. One shared word ("Arkham City" and "River City Girls") isn't the same game.
- **FR-10.4b** A name that fits two owned games equally well gets a "which one?" question. When one game in a request is unclear, the clear steps run first and only the unclear part waits for the answer; answering doesn't repeat the steps already done.
- **FR-10.5** Removing a game from the library asks for confirmation first.
- **FR-10.6** Questions get an answer written with the player's library and IGDB facts. Questions never change data.
- **FR-10.7** Replies describe what actually happened, not what the model claimed.
- **FR-10.8** The conversation can be cleared.
- **FR-10.9** In the cloud, each player has a daily message allowance (default 150). Past it, the assistant says so and everything else keeps working.

### 3.11 Cloud sync

- **FR-11.1** A player on a PC can start syncing. Either a new cloud account is made from the PC account, keeping its id and password, or the player signs in to an existing cloud account and the libraries are merged.
- **FR-11.2** A linked PC sends changes about 4 seconds after they happen and syncs every 60 seconds. Changes made while offline are sent when it's back online.
- **FR-11.3** Games, collections, reviews, notes, play sessions, activities and dismissals sync. Executable paths and store sign-ins don't.
- **FR-11.4** The same game added on two devices becomes one game. On conflicting edits, the later change wins. Deletes propagate.
- **FR-11.5** A player can sync now, stop syncing (keeping the PC library), and sign in again after a password change.
- **FR-11.6** The phone app reads and writes the cloud copy directly.
- **FR-11.7** Desktop login and sign-up have a "Sync with my other devices" checkbox, ticked by default. When ticked, the PC links to the cloud in the background after a local sign-in, as in FR-11.1.
  - It never blocks or fails the local sign-in.
  - Offline, the choice is kept and retried every minute until the PC is online.
  - After "Stop syncing" or "Not now" the box starts unticked.
- **FR-11.8** When the cloud name is already taken:
  - the sign-up form says so while the player types, with up to three free names (the check says only taken or free)
  - linking silently tries the just-typed password on that cloud account (by username, then email); if it works, the libraries merge
  - otherwise the local account keeps working, and Settings shows "Sync needs your attention" once, offering a suggested free name, another name, "It's mine" (that account's password) or "Not now"
- **FR-11.9** A linked PC can show a link code as digits and as a QR code (`roninarc://link/<code>`) from Settings → "Connect your phone" or the dashboard banner. A PC that isn't linked yet is linked first.
  - The phone scans the QR code or types the code and is signed in to the same cloud account with no password and no cloud name.
  - A code lasts 10 minutes, works once, and making a new one cancels the old one.
- **FR-11.10** The desktop dashboard shows a dismissible "Get your library on your phone" banner while the library has games and no phone has signed in to the account. Settings always has a "Your phone" row.

### 3.12 Desktop app lifecycle

- **FR-12.1** Only one instance runs at a time.
- **FR-12.2** On first launch the app creates its JWT secret and enrolls with keygate. Without a keygate token, offline features keep working.
- **FR-12.3** The app checks for updates shortly after starting and every 4 hours, downloads in the background, and asks before restarting. Otherwise it installs on quit. From 1.0.2 on, an update downloads only the parts that changed since the installed version.
- **FR-12.4** "Create problem report" saves a zip of recent logs, including the 40 newest AI request logs, to the Desktop with tokens, keys and passwords removed.

### 3.13 Android app

- **FR-13.1** A player can sign in (username or email), sign up and reset their password against RoninArc Cloud, or sign in by scanning or typing a link code from their PC (FR-11.9).
- **FR-13.1a** While the cloud is waking up, sign-in and sign-up wait (up to about 100 seconds) and say "Waking up the server…" instead of failing.
- **FR-13.1b** A phone with an empty library shows "Your games are on your PC" with "Scan code from your PC", "Enter code" and "No PC? Add a game here".
- **FR-13.2** A player can browse their library, collections and dashboard, change statuses, rate, review, take notes and add games.
- **FR-13.3** A player can use the AI assistant. The conversation survives leaving the screen.
- **FR-13.4** Settings matches the desktop's one-column layout: account and log out, RoninArc Cloud ("Syncing as …", how this phone was connected, use a code from a PC), change password, delete account, and the app version with the IGDB credit.

### 3.14 Landing page

- **FR-14.1** The download buttons always serve the newest GitHub release (`releases/latest/download/RoninArc-Setup.exe` and `RoninArc.apk`).
- **FR-14.2** The version shown is the desktop version at build time, replaced by the newest GitHub release tag when the page loads.

## 4. Non-functional requirements

### 4.1 Offline-first

- **NFR-1.1** On the desktop, the library, reviews, notes, collections, dashboard, play tracking and launching work with no internet.
- **NFR-1.2** Online features (search, AI, store import, discover recommendations, sync) fail with a clear message and never block offline ones.

### 4.2 Security

- **NFR-2.1** Passwords are stored as bcrypt hashes and never logged.
- **NFR-2.2** Each desktop install has its own JWT secret. No secret is shipped in the installer or committed to the repo.
- **NFR-2.3** API keys for IGDB, NVIDIA and Steam live only in keygate. Clients get per-install, rate-limited tokens.
- **NFR-2.4** Every API call is scoped to the signed-in user. Someone else's ids behave as not found.
- **NFR-2.5** Sync accepts only plain data the app's own models would write: no query operators, and no changing the owner.
- **NFR-2.6** HTTP security headers come from Helmet. In the cloud, CORS is limited to `ALLOWED_ORIGIN`.
- **NFR-2.7** Problem reports and logs remove tokens, keys and bearer headers.
- **NFR-2.8** Link codes are stored only as an HMAC under the server secret, expire after 10 minutes (TTL index), work once, and are limited to one per account. Claims are limited to 10 per 15 minutes per network; making codes to 20 per 15 minutes per account; name checks to 120 per 15 minutes per network.

### 4.3 Privacy

- **NFR-3.1** Without sync, no library data leaves the PC except game searches (to IGDB) and chat messages (to the AI model).
- **NFR-3.2** Executable paths and Steam/Epic credentials never leave the PC, even when syncing.
- **NFR-3.3** Deleting an account deletes all its data on that device, and in the cloud for a cloud account.

### 4.4 Performance

- **NFR-4.1** A warm desktop start takes a few seconds. A cold start (first launch, after a reboot) may take up to about 30 seconds, during which a splash screen shows.
- **NFR-4.2** A planned AI request normally answers in a few seconds. The NVIDIA primary model has a 6-second budget before fallbacks are tried.
- **NFR-4.3** IGDB metadata is fetched in batches, not one call per game.
- **NFR-4.4** A sync push carries at most 1,000 records per batch and 15 MB per request.

### 4.5 Reliability

- **NFR-5.1** Two desktop instances never open the same database.
- **NFR-5.2** Failed sync attempts are retried. Pending changes are counted and shown in Settings.
- **NFR-5.3** Server errors are logged with a request id and sent to Sentry when configured.
- **NFR-5.4** AI request logs are kept in the app's log folder (`LOG_DIR/ai`), so they survive reinstalls. Logs older than 14 days are deleted, and the oldest days go first past 150 MB.

### 4.6 Usability

- **NFR-6.1** Light and dark themes. The layout works down to phone width.
- **NFR-6.2** Messages use plain words and say what to do next.

### 4.7 Maintainability and testing

- **NFR-7.1** Every route is documented in the OpenAPI document, and a test fails otherwise.
- **NFR-7.2** The Playwright suite (about 630 API tests and a UI project of about 150) runs against isolated servers: its own MongoDB, mock IGDB, Resend and Sentry, a local backend and a cloud backend.
- **NFR-7.3** A reported bug gets a test that reproduces it.

## 5. External interfaces

| Interface | Direction | Notes |
|---|---|---|
| REST API | clients → backend | JSON over HTTP, Bearer auth, OpenAPI 3.1 at `/api/docs.json` |
| IGDB | backend → keygate → IGDB | Search, details, batch metadata |
| NVIDIA NIM | backend → keygate → NVIDIA | Planning and answer models, with fallbacks |
| Steam | desktop (OpenID window), backend → keygate → Steam Web API | Owned games |
| Epic | desktop (OAuth window), backend → Epic APIs | Owned games, store slugs via Electron's network stack |
| Resend | cloud → Resend | Password reset emails |
| GitHub Releases | desktop updater, landing page → GitHub | `latest.yml`, versioned installer and blockmap (differential updates), fixed-name installer copy, APK, latest release tag |
| Camera | phone | Scanning the PC's QR code (`expo-camera`, no microphone) |
| Electron IPC | UI → desktop | App info, updates, problem report, choose exe, launch, scan, store sign-in, open store page |

## 6. Planned requirements (not built yet)

- **Link-code claims across networks:** claims are limited per network only. A global limit (or a longer code) would cap guessing spread over many networks.
- **Switching a phone's account by code:** the old account's refresh token isn't revoked; it just expires. It should be revoked.
- **Release signing for the APK:** the APK is signed with the debug key. A release keystore is needed before wider sharing, and every later APK must use the same key.
