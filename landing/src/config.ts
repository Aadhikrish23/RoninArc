// Where the download buttons point. GitHub's "latest/download/<name>" links always serve the newest
// release, so they never need editing as long as each release uploads files with these exact names.
// Override per build with VITE_WINDOWS_URL / VITE_ANDROID_URL if the files live somewhere else.
export const RELEASES_URL = "https://github.com/Aadhikrish23/RoninArc/releases";

export const WINDOWS_URL =
  import.meta.env.VITE_WINDOWS_URL || `${RELEASES_URL}/latest/download/RoninArc-Setup.exe`;

export const ANDROID_URL =
  import.meta.env.VITE_ANDROID_URL || `${RELEASES_URL}/latest/download/RoninArc.apk`;

// The desktop app's version at build time (vite.config.ts); useLatestVersion() swaps in the newest
// GitHub release when the page loads.
export const VERSION = __APP_VERSION__ || "1.0.2";

export const LATEST_RELEASE_API = "https://api.github.com/repos/Aadhikrish23/RoninArc/releases/latest";
