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
    };
  }
}
