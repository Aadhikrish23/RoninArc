# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (this record covers the marketing landing page; the products themselves are a Windows desktop app built in React and an Android app built in Expo)

## Users
PC gamers whose games are spread across Steam, Epic and other launchers, with a backlog they've lost track of. They want one place to see what they own, track what they're playing, plan what's next and keep notes, without a spreadsheet. The landing page serves two groups at once:
- strangers finding RoninArc for the first time, who need to understand it and trust it enough to download
- invited beta testers, who just need the downloads

## Product Purpose
RoninArc is a personal game library and backlog tracker for Windows, with an AI assistant you talk to in plain language. The landing page succeeds when a visitor understands what RoninArc is, trusts it's an honest early beta, and downloads the Windows app or the Android companion.

## Positioning
- **Offline-first:** the library, ratings, reviews, notes, collections, dashboard and game launching all work with no internet, stored on the user's own PC. Cloud sync is optional.
- **An assistant that acts:** it changes the library instead of only chatting. Examples: "I finished celeste, 9/10", "make a soulslike collection and put ds3 in it", "what should I play tonight? I've got 2 hours", "undo that".
- **Your real library:** it imports what you own from Steam and Epic, and launches installed games directly.

## Operating Context
- Windows installer (`RoninArc Setup 1.0.0.exe`). It isn't code-signed, so Windows SmartScreen shows "Windows protected your PC" (More info → Run anyway). The app updates itself automatically.
- Android APK (sideloaded, version 1.0.0) that syncs with the desktop through RoninArc Cloud.
- Downloads are hosted on GitHub Releases: https://github.com/Aadhikrish23/RoninArc/releases

## Capabilities and Constraints
- **Library:** statuses (Playing, Plan to play, Completed, Paused, Dropped), ratings, reviews, per-game notes, collections, a dashboard of backlog progress and recent activity, "Recommended for you", and playtime tracking for games launched through RoninArc.
- **Needs internet:** game search, covers and details, the AI assistant, Steam/Epic import, and recommendations.
- **AI daily limit:** the AI has a limit per PC that resets daily.
- **Cloud sync:** RoninArc Cloud (opt-in account) syncs desktop ↔ Android. Forgot-password works by email.
- **Platforms:** Windows only on desktop; Android only on mobile (no iOS).
- **Price:** not stated anywhere on the page (user decision).
- **Beta:** the product is in public beta and the page says so.

## Brand Commitments
- Name: **RoninArc**. Existing logo: `desktop/assets/logo.jpg`; app icon: `desktop/build/icon.ico`.
- Voice: plain, honest, a friend explaining it. It admits rough edges ("Things will break; that's what you're helping find.").
- Ecosystem context: the user's other planned apps (Sensei, Shiori, Kaizen, Hina) share the Japanese-named family.

## Evidence on Hand
- Real feature list and example assistant prompts (docs/beta/START_HERE.md).
- Real product UI in `frontend/` (the desktop app) and `mobile/`.
- There are NO testimonials, user counts, reviews, press, ratings or benchmarks. Do not invent any.

## Product Principles
1. Your library is yours: local by default; anything that leaves the PC is stated plainly.
2. Talk, don't fill in forms: the assistant is the fastest path to any change.
3. Honest beta: name the rough edges up front instead of hiding them.
4. Real games, real library: import what you own rather than starting from zero.
