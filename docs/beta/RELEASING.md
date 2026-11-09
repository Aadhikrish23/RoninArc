# Releasing a new version

Releases are GitHub releases on `Aadhikrish23/RoninArc`. Two things read them:
- **The desktop app's updater** reads the GitHub releases feed. From 1.0.2 on, installer names carry the version, so an update downloads only the parts that changed since the installed version, using the previous release's blockmap.
- **The landing page's download buttons** use the fixed names at `https://github.com/Aadhikrish23/RoninArc/releases/latest/download/<file>`.

Each release uploads these files:

| File | For |
|---|---|
| `RoninArc-Setup-<version>.exe` | The installer the updater downloads |
| `RoninArc-Setup-<version>.exe.blockmap` | Lets the *next* version update by downloading only changes |
| `latest.yml` | How installed apps learn there's a new version |
| `RoninArc-Setup.exe` | The same installer under a fixed name, for the website |
| `RoninArc.apk` | The Android app |

**Upload the APK every time**, even if it hasn't changed. Otherwise the website's Android button breaks.

Apps still on 1.0.0 or 1.0.1 read `latest/download/latest.yml`, which points at the versioned installer in the same release. They do one last full download (about 140 MB); after that, updates are differential.

## One-time setup

Two gitignored files sit in `desktop/` and are packaged into the installer. Copy each from its `.example.json`.

- **`desktop/keygate.json`:**
  - the deployed keygate URL
  - `"project": "roninarc"`
  - the `RONINARC_ENROLL_KEY` secret
- **`desktop/release.json`:**
  - `"github": { "owner": "Aadhikrish23", "repo": "RoninArc" }`, where updates come from (the older `"updateUrl"` form still works but can't do differential updates)
  - `"cloudUrl"`: RoninArc Cloud's address (see [../cloud/DEPLOY.md](../cloud/DEPLOY.md))

**Warning:** don't send anyone a build made while these point at `localhost`. Those are test builds and only work on the machine that built them.

Install the GitHub CLI and sign in once with `gh auth login`.

## Each release

1. **Bump the version** in `desktop/package.json`. Installs only update to a higher version.
   ```bash
   cd desktop
   npm version 1.0.3 --no-git-tag-version
   ```
   If the phone app changed, also bump `version` in `mobile/app.config.ts` (and `mobile/package.json`) **and raise `android.versionCode`**. Android refuses to install an APK over one with the same or a higher `versionCode`.
2. **Build the installer.** `predist` fetches MongoDB, builds the backend from a clean `dist/` and the frontend, and copies the frontend in. `dist` runs `electron-builder --publish never`, so building never uploads anything.
   ```bash
   npm run predist && npm run dist
   ```
   Output: `desktop/dist/RoninArc-Setup-<version>.exe`, its `.blockmap` and `latest.yml`. Check that `latest.yml` shows the new version.
3. **Build the APK** if the phone app changed (see below).
4. **Stage the release files:**
   ```bash
   npm run stage-release -- --apk ../mobile/android/app/build/outputs/apk/release/app-release.apk
   ```
   Without `--apk`, the newest `release/v*/RoninArc.apk` is reused. This copies the five files into `release/v<version>/` (adding the fixed-name `RoninArc-Setup.exe`) and prints the `gh release create` command.
5. **Commit and push** the version bump. If the cloud changed, make sure RoninArc Cloud is redeployed before publishing (see [../cloud/DEPLOY.md](../cloud/DEPLOY.md)).
6. **Publish** with the printed command, which looks like:
   ```bash
   gh release create v1.0.3 --target main --title "RoninArc 1.0.3" --latest --notes-file notes.md \
     release/v1.0.3/RoninArc-Setup-1.0.3.exe release/v1.0.3/RoninArc-Setup-1.0.3.exe.blockmap \
     release/v1.0.3/latest.yml release/v1.0.3/RoninArc-Setup.exe release/v1.0.3/RoninArc.apk
   ```
7. **Check** that the links serve the new files:
   ```bash
   curl -sL https://github.com/Aadhikrish23/RoninArc/releases/latest/download/latest.yml | head -1
   ```
   The first line should be the new version. The website's version updates itself from the latest release tag.

Installed copies find the update shortly after they start and every 4 hours, or straight away from **Settings → About and support → Check for updates**. It downloads in the background, then asks whether to restart now. Otherwise it updates the next time the app is closed.

## Building the APK

From `mobile/`:

```bash
node scripts/build-release.cjs https://roninarc-cloud.onrender.com
```

This regenerates `android/` with the cloud address baked in and builds with low-memory settings. The cloud address defaults to the live one if left out. Copy `android/app/build/outputs/apk/release/app-release.apk` to the release folder as `RoninArc.apk`. See `mobile/README.md` for details and signing.

## Checking an update locally first

1. Build version N with `release.json` pointing at `http://localhost:8099/`.
2. Build version N+1 into a separate folder:
   ```bash
   npx electron-builder --config.extraMetadata.version=<N+1> --config.directories.output=dist-update
   ```
3. Serve `dist-update/` on port 8099.
4. Launch N's `dist/win-unpacked/RoninArc.exe --user-data-dir=<empty temp folder>`.
5. Watch `startup.log` in that folder: you should see `Found version N+1`, then `state {"state":"ready"...}`.
6. Afterwards, delete `%LOCALAPPDATA%\desktop-updater`. Otherwise a real install would apply that test update on quit.
