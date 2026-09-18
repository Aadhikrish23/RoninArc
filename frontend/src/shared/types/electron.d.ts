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
    };
  }
}
