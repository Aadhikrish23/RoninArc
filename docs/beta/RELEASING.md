# Releasing a new version

Releases are GitHub releases on `Aadhikrish23/RoninArc` with fixed file names. Two things read them through the "latest release" links:
- the desktop app's updater
- the landing page's download buttons

`https://github.com/Aadhikrish23/RoninArc/releases/latest/download/<file>`

Each release must upload these files:
- `RoninArc-Setup.exe`
- `RoninArc-Setup.exe.blockmap`
- `latest.yml`
- `RoninArc.apk`

Upload the APK every time, even if it hasn't changed. Otherwise the website's Android button breaks.

## One-time setup

Two gitignored files sit in `desktop/` and are packaged into the installer. Copy each from its `.example.json`.

- **`desktop/keygate.json`:**
  - the deployed keygate URL
  - `"project": "roninarc"`
  - the `RONINARC_ENROLL_KEY` secret
- **`desktop/release.json`:**
  - `"updateUrl": "https://github.com/Aadhikrish23/RoninArc/releases/latest/download/"`, which must end with `/`
  - `"cloudUrl"`: RoninArc Cloud's address (see [../cloud/DEPLOY.md](../cloud/DEPLOY.md))

**Warning:** don't send anyone a build made while these point at `localhost`. Those are test builds and only work on the machine that built them.

Install the GitHub CLI and sign in once with `gh auth login`.

## Each release

1. **Bump the version** in `desktop/package.json`. Installs only update to a higher version.
   ```bash
   cd desktop
   npm version 1.0.2 --no-git-tag-version
   ```
2. **Build the installer.** `predist` fetches MongoDB, builds the backend and the frontend, and copies the frontend in.
   ```bash
   npm run predist && npm run dist
   ```
   Output: `desktop/dist/RoninArc-Setup.exe`, `RoninArc-Setup.exe.blockmap`, `latest.yml`. Check that `latest.yml` shows the new version.
3. **Copy the files into a release folder,** for example `release/v1.0.2/`. Add `RoninArc.apk`, either a new build (see below) or the previous one.
4. **Commit and push** the version bump.
5. **Publish:**
   ```bash
   gh release create v1.0.2 --target main --title "RoninArc 1.0.2" --latest --notes-file notes.md \
     release/v1.0.2/RoninArc-Setup.exe release/v1.0.2/RoninArc-Setup.exe.blockmap \
     release/v1.0.2/latest.yml release/v1.0.2/RoninArc.apk
   ```
6. **Check** that the links serve the new files:
   ```bash
   curl -sL https://github.com/Aadhikrish23/RoninArc/releases/latest/download/latest.yml | head -1
   ```
   The first line should be the new version.

Installed copies find the update shortly after they start and every 4 hours, or straight away from **Settings → About and support → Check for updates**. It downloads in the background, then asks whether to restart now. Otherwise it updates the next time the app is closed.

**Download size:** every release has the same file name, so the updater can't fetch only the changed parts from the previous version. It downloads the whole installer, about 140 MB.

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
