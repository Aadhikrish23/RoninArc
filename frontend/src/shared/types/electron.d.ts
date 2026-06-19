export {};

declare global {
  interface Window {
    electronAPI?: {
      selectExePath: () => Promise<string | null>;
      launchGame: (exePath: string) => Promise<boolean>;
    };
  }
}
