export {};

interface EpicGame {
  name: string;
  installPath: string;
  executable: string;
  epicId: string;
  catalogItemId: string;
  catalogNamespace: string;
  appName: string;
}

interface UpdateStatus {
  state: "disabled" | "idle" | "checking" | "up-to-date" | "downloading" | "ready" | "error";
  current: string;
  version?: string;
  percent?: number;
  message?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      selectExePath: () => Promise<string | null>;

      launchGame: (gameId: string, exePath: string) => Promise<boolean>;

      scanEpicGames: () => Promise<EpicGame[]>;

      onGameExited?: (callback: (gameId: string) => void) => () => void;

      scanSteamGames: () => Promise<
        {
          appId: string;
          name: string;
          installPath: string;
          executable: string;
        }[]
      >;

      /**
       * Opens a child BrowserWindow for Epic OAuth, monitors navigation events,
       * extracts the authorization code from the redirect URL or JSON body, and
       * closes the window automatically.
       *
       * Returns:
       *   - string  → authorization code (success)
       *   - null    → user cancelled / closed the window
       *   - "ERROR:<message>" → an error occurred during the flow
       */
      epicLogin: (loginUrl: string) => Promise<string | null>;

      /**
       * Opens a child BrowserWindow for Steam's "Sign in through Steam"
       * (OpenID), monitors navigation until it reaches our own backend's
       * relay route, and returns that URL's raw query string.
       *
       * Returns:
       *   - string  → raw openid.* query string (success, still unverified)
       *   - null    → user cancelled / closed the window
       *   - "ERROR:<message>" → an error occurred during the flow
       */
      steamLogin: (loginUrl: string) => Promise<string | null>;

      getAppInfo?: () => Promise<{ version: string; packaged: boolean }>;
      getUpdateStatus?: () => Promise<UpdateStatus>;
      checkForUpdates?: () => Promise<UpdateStatus>;
      /** Restarts into a downloaded update; false if none is ready. */
      installUpdate?: () => Promise<boolean>;
      /** Zips the logs (secrets removed) onto the Desktop and shows the file. */
      createProblemReport?: () => Promise<{ ok: boolean; path?: string; message?: string }>;
    };
  }
}
