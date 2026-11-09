# RoninArc: start here

Thanks for trying RoninArc. It's a game library for your PC: every game you own in one place, with your statuses, ratings, notes and collections, plus an AI assistant you can just talk to.

It's an early version. Things will break; that's what you're helping find.

## Install

1. Run **`RoninArc-Setup.exe`** (the file may also be called `RoninArc-Setup-<version>.exe`).
2. Windows will probably show **"Windows protected your PC"**. That's because the app isn't signed with a paid certificate yet, not because anything is wrong. Click **More info**, then **Run anyway**.
3. Pick an install folder (the default is fine) and finish.

RoninArc runs on Windows only for now.

## First launch

1. Open RoninArc from the Start menu or desktop shortcut. The first start takes a few seconds longer while it sets itself up.
2. Create an account. **"Sync with my other devices"** is ticked by default: it also puts your library in RoninArc Cloud, so your phone can use it. Untick it to keep everything only on this PC. With it ticked, use a real email address (that's how a forgotten password is reset); the form tells you straight away if your username is already taken in the cloud, and suggests free ones.
3. Your library starts empty. Search for a game at the top and add it, or connect Steam/Epic in **Settings** to import what you own (optional).

## Things to try

- Set statuses (Playing, Plan to play, Completed, Paused, Dropped), rate and review games, add notes, make collections.
- Open a game's page for details, screenshots and your notes.
- The **Dashboard** for your backlog progress and recent activity.
- **Recommended for you** on the library page.
- The **AI assistant** (the button in the bottom corner). Talk to it like a friend:
  - "add elden ring"
  - "I finished celeste, 9/10"
  - "make a soulslike collection and put ds3 in it"
  - "what should I play tonight? I've got 2 hours"
  - "pause rdr2 I'm taking a break"
  - "undo that"
  - "is elden ring harder than ds3?"
- **Launch** a game straight from RoninArc (for games installed on this PC).
- **Install** a Steam or Epic game you own but don't have on this PC: its card has a button that opens the game's page in Steam or Epic. Once it's installed, use **Rescan PC Games** to launch it from RoninArc.

## What needs internet

- **Works offline:** your library, ratings, reviews, notes, collections, the dashboard and launching games.
- **Needs internet:**
  - game search, covers and details
  - the AI assistant
  - Steam/Epic import
  - recommendations of new games
  - cloud sync and the phone app

The AI has a daily limit per PC. If you hit it, it tells you, and it resets at 5:30 AM (IST), which is midnight UTC.

## Your data

- Everything you add (library, notes, reviews, collections, your account) is stored **on your PC**.
- When you search for a game or talk to the AI, that search or message goes over the internet to look things up or get an answer. Nothing else about your library is uploaded, unless you turn on cloud sync.

## On your phone (optional)

There's an Android app too: **`RoninArc.apk`** from the same download page.

1. On the phone, install the APK (allow installing from your browser when Android asks).
2. On the PC, click **Show the code** on the dashboard's "Get your library on your phone" banner, or open **Settings → RoninArc Cloud → Connect your phone**. It shows a QR code and a 6-digit code (valid for 10 minutes). If the PC wasn't syncing yet, this turns sync on first.
3. On the phone, tap **Scan code from your PC** and point the camera at the QR code, or tap **Enter code** and type the 6 digits. You're signed in with no password, and your library comes down.

You can also sign in on the phone with your username **or email** and your password.

If the phone says **"Waking up the server…"**, give it up to a minute. The cloud server sleeps when nobody's used it for a while, and the first request wakes it up.

If Settings on the PC says **"Sync needs your attention"**, your username is already taken in RoninArc Cloud by someone else. Pick one of the suggested names, or choose **It's mine** if that cloud account is yours.

Your game exe paths and Steam/Epic sign-ins never leave the PC. If you turn sync off, your library stays on the PC.

## Found a bug? Something confusing?

Tell me what you did, what happened, and what you expected. A screenshot helps a lot.

For anything that went wrong, open **Settings → About and support → Create problem report**. It saves a zip to your Desktop with RoninArc's recent logs, including the assistant's recent request logs; send me that file. Passwords, tokens and keys are removed from it automatically. It does include your recent AI messages and game names, so skim it first if you'd like.

If RoninArc won't start at all, send me `startup.log` from **`%APPDATA%\desktop`** instead: paste that into the File Explorer address bar.

Everything is useful: bugs, things that felt slow, ugly or confusing, features you wished it had. Just use it the way you normally would for a week.

## Known rough edges

- The Windows "protected your PC" warning on install (see above).
- **Updates are automatic.** RoninArc checks for a new version shortly after it starts and every few hours, downloads it in the background, then asks whether to restart now or update the next time you close it. Your library is kept. You can also check yourself in **Settings → About and support**.
- Playtime is only tracked for games you launch through RoninArc.
