export interface LocalSteamGame {
  appId: string;
  name: string;
  installPath: string;
  executable: string;
}

/**
 * RoninArc has no Steam Web API / OAuth integration -- Steam ownership is
 * derived entirely from scanning the local Steam install (registry +
 * steamapps manifests) via the Electron main process. That scan is the only
 * source of truth for both "connect" and "resync", so both call this first.
 */
export async function scanLocalSteamLibrary(): Promise<LocalSteamGame[]> {
  const scan = window.electronAPI?.scanSteamGames;
  if (!scan) {
    throw new Error("Steam sync requires the RoninArc desktop app.");
  }
  return scan();
}
