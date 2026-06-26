export {};

interface EpicGame {
  name: string;
  installPath: string;
  executable: string;
  epicId: string;
}

declare global {
  interface Window {
    electronAPI?: {
      selectExePath: () => Promise<string | null>;

      launchGame: (gameId: string, exePath: string) => Promise<boolean>;

      scanEpicGames: () => Promise<EpicGame[]>;

      onGameExited?: (callback: (gameId: string) => void) => void;

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
    };
  }
}
