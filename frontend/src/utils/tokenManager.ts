let tokenUpdater:
  | ((access: string, refresh: string) => void)
  | null = null;

export const setTokenUpdater = (
  updater: (
    access: string,
    refresh: string
  ) => void
) => {
  tokenUpdater = updater;
};

export const updateAuthTokens = (
  access: string,
  refresh: string
) => {
  tokenUpdater?.(access, refresh);
};