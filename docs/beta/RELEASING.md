# Releasing a new version of the desktop app

Friends' installs update themselves from `release.json`'s `updateUrl`. A release is:
1. build an installer with a higher version
2. upload three files to that address

## One-time setup

Two gitignored files sit in `desktop/` and are packaged into the installer. Copy each from its `.example.json`.

- `desktop/keygate.json`: the deployed keygate URL, `"project": "roninarc"`, and the `RONINARC_ENROLL_KEY` secret.
- `desktop/release.json`: `"updateUrl"`, the folder the release files are served from.
  - It must end with `/`.
  - Any static host works: a public Cloudflare R2 bucket, a GitHub release, etc.

**Warning:** don't send anyone a build made while these point at `localhost`. Those are test builds and only work on the machine that built them.

## Each release

1. Bump `"version"` in `desktop/package.json`, e.g. `1.0.0` → `1.0.1`. Installs only update to a **higher** version.
2. Build:
   ```bash
   cd desktop
   npm run predist && npm run dist
   ```
3. Upload these from `desktop/dist/` to the `updateUrl` folder, replacing `latest.yml`:
   - `latest.yml`
   - `RoninArc Setup <version>.exe`
   - `RoninArc Setup <version>.exe.blockmap`

   Keep the previous version's `.blockmap` there too. Installs then download only the changed parts. Without it they download the whole installer, which also works.
4. That's it. Each install finds the update within a few hours, or when it next starts, or straight away via **Settings → About and support → Check for updates**. It downloads in the background, then asks whether to restart now. Otherwise it updates the next time the app is closed.

New friends get the newest `RoninArc Setup <version>.exe` directly.

## Checking a release locally first

1. Build version N with `release.json` pointing at `http://localhost:8099/`.
2. Build version N+1 into a separate folder:
   ```bash
   npx electron-builder --config.extraMetadata.version=<N+1> --config.directories.output=dist-update
   ```
3. Serve `dist-update/` on port 8099.
4. Launch N's `dist/win-unpacked/RoninArc.exe --user-data-dir=<empty temp folder>`.
5. Watch `startup.log` in that folder: you should see `Found version N+1`, then `state {"state":"ready"...}`.
6. Afterwards, delete `%LOCALAPPDATA%\desktop-updater`. Otherwise a real install would apply that test update on quit.
