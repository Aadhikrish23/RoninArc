export {};

declare global {
  interface Window {
    electronAPI?: {
      selectExePath: () => Promise<string | null>;
      launchGame: (gameId: string, exePath: string) => Promise<boolean>;

      onGameExited?: (callback: (gameId: string) => void) => void;
    };
  }
}
