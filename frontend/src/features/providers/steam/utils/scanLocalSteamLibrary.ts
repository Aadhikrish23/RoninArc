export interface LocalSteamGame {
  appId: string;
  name: string;
  installPath: string;
  executable: string;
}

/**
 * Steam ownership (the full library, installed or not) comes from the Steam
 * Web API via SteamAuthStrategy, not this scan -- this only detects which of
 * those owned games are actually installed on THIS PC (registry + steamapps
 * manifests), which needs the Electron main process. Callers should treat
 * this as a best-effort enrichment: catch and ignore failures (e.g. running
 * in a browser, or Steam not installed) rather than blocking on it.
 */
export async function scanLocalSteamLibrary(): Promise<LocalSteamGame[]> {
  const scan = window.electronAPI?.scanSteamGames;
  if (!scan) {
    throw new Error("Steam sync requires the RoninArc desktop app.");
  }
  return scan();
}
