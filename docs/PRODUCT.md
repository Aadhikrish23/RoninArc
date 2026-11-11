# RoninArc product document

Version 1.0.3 (November 2026). Status: early beta, shared with invited testers.

## What it is

RoninArc is a personal game library and backlog tracker for Windows PC gamers, with an Android companion app and an AI assistant you talk to in plain language.

It brings every game you own into one place, whatever store it came from. You track what you're playing, what's next and what you finished, and you can rate, review, take notes and make collections. It launches installed games and records how long you play.

## Who it's for

- **PC gamers with games spread over Steam, Epic and other launchers.** They have a backlog they've lost track of and want one place to see it, without keeping a spreadsheet.
- **People who like talking to their tools.** They'd rather say "I finished Celeste, 9/10" than click through forms.
- **Beta testers (now):** friends of the developer trying it in daily use and reporting problems.

## The problem

- Owned games are scattered across launchers, each with its own library and no shared view.
- Backlogs grow without anyone noticing what's started, paused or abandoned.
- Generic tracking sites need everything typed in by hand, don't know what you own, and can't launch anything.

## Principles

- **Offline-first.** The library, ratings, reviews, notes, collections, dashboard and game launching all work with no internet. Data lives on the user's own PC.
- **The assistant acts.** It changes the library, not just chats. It checks its plan against what the user actually said, so it doesn't change things nobody asked for.
- **Your real library.** Import what you own from Steam and Epic, and launch installed games from RoninArc.
- **Honest beta.** Problems are easy to report, and nothing secret goes into a report.
- **No keys on users' machines.** API keys stay in keygate. Each install gets its own limited token.

## Features by platform

### Windows desktop app (main product)

- **Account:**
  - Sign in with an **email** and password. Sign-up asks for a name (shown in the app, doesn't have to be unique), an email and a password, with "Remember me" and "Sync with my other devices" (ticked by default). A cloud account made on the phone can also sign in on a PC with its email, and its library comes down.
  - A PC account made before email sign-in (no email) still signs in with its old name and is asked once to add an email (password-confirmed); Settings keeps offering it until it's added.
  - Change password, sign out everywhere, delete the account.
- **Library:**
  - Search IGDB and add games.
  - Statuses: Plan to Play, Playing, Paused, Completed, Dropped.
  - Filters and sorting.
  - A game page with summary, screenshots, genres, critic and community scores, and time to beat.
- **Ratings and reviews:** 1–10 with optional text, one per game.
- **Notes:** any number per game.
- **Collections:** create, rename, delete, add and remove games.
- **Dashboard:** totals by status, ratings, playtime, most played, recent activity, continue playing.
- **Recommendations:**
  - "Play next" from the user's own backlog.
  - "Discover" picks from IGDB based on taste (genres, style tags, ratings).
  - Each pick comes with a reason, and any pick can be dismissed.
- **Steam and Epic:**
  - Sign in once to import the whole owned library, and resync whenever.
  - Installed games are found on the PC and can be launched.
  - Owned games that aren't installed get an "Open in Steam/Epic" button.
- **Launching and play time:** launch from an exe or through Steam/Epic. The session ends when the game's own process closes.
- **AI assistant** (floating button and full page). It understands requests like these:
  - "add elden ring"
  - "I finished celeste, 9/10"
  - "make a soulslike collection and put ds3 in it"
  - "create a God of War collection with all my God of War games"
  - "add the Batman Arkham games, make a Batman collection and put them in it" (if one game is unclear, it does the rest and asks only about that one)
  - "what should I play tonight? I've got 2 hours"
  - "launch hades"
  - "undo that"

  It also answers general game questions.
- **Cloud sync and the phone:**
  - Ticking "Sync with my other devices" at sign-in (the default) puts the library in RoninArc Cloud in the background. If the PC is offline, it does this once it's back online.
  - If the email already has a cloud account (made on the phone first, say), the same password links to it and the libraries merge. A different password puts "Sync needs your attention" in Settings, which asks for that account's password.
  - "Connect your phone" (Settings, or the dashboard banner "Get your library on your phone") shows a QR code and a 6-digit code. The phone signs in by scanning or typing it, with no password.
  - Turning sync off keeps everything on the PC.
- **Updates:** automatic, from GitHub releases, downloading only what changed. The app asks before restarting.
- **Support:** one-click problem report zipped to the Desktop, including the recent AI logs.
- **Appearance:** light and dark themes.

### Android app (companion)

- Sign in with email and password, sign up (name, email, password) and forgot password against RoninArc Cloud, or sign in by scanning the PC's QR code or typing its 6-digit code. While the cloud wakes up, it says "Waking up the server…" instead of failing.
- An empty library shows "Your games are on your PC" with Scan code / Enter code.
- Library home with collections and recommendations; all games; game page with status, rating, review and notes; collection pages.
- Add games from IGDB search.
- Dashboard with stats and activity.
- The AI assistant.
- Settings in the same one-column style as the desktop: account, RoninArc Cloud ("Syncing as …"), change password, delete account, app version.

### Landing page

A static site with what RoninArc is, examples of talking to the assistant, and download buttons for the latest Windows installer and Android APK.

## Where data lives

- **On the PC:** everything, in an embedded MongoDB in the user's app data folder.
- **In RoninArc Cloud:** only for accounts that turned on sync, or that were created on the phone. Executable paths and Steam/Epic sign-ins never leave the PC.
- **Sent to services:** game searches go to IGDB, chat messages go to the AI model, and Steam/Epic library requests go to those stores. All of these pass through keygate.

## Non-goals (for now)

- Buying, downloading or installing games (RoninArc opens the store page instead).
- Social features: friends, sharing, public profiles.
- Achievements and trophies.
- macOS, Linux or iOS apps.
- GOG, Xbox, EA or Ubisoft imports.
- A web version for everyday use. The UI runs in a browser for development, but launching games and store sign-ins need the desktop app.

## Known limits

- The installer isn't code-signed, so Windows shows "Windows protected your PC" on install.
- The cloud runs on Render's free plan, so the first request after a quiet period can take about a minute (the apps wait and say so).
- Playtime is only tracked for games launched through RoninArc.
- The AI has a daily limit per person in the cloud, and per install through keygate.
- The phone shows a PC's library only once that PC syncs. Sync is on by default at sign-in, but a player who unticks it must turn it on later.
- The APK is signed with a debug key, which is fine for testers but not for wide release.

## Success measures for the beta

- Testers keep using it for a week of normal play without a blocking bug.
- Most assistant requests do what was asked on the first try (tracked through playtest rounds and the AI logs).
- Every reported bug gets a reproducing test in `e2e/` before it's marked fixed.
