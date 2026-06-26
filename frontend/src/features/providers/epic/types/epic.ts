export interface EpicProviderStatus {
  connected: boolean;

  displayName: string | null;

  connectedAt: string | null;
}

export interface EpicConnectPayload {
  authorizationCode: string;
}

export interface EpicConnectResult {
  connected: boolean;

  displayName: string;

  imported: number;

  totalGames: number;

  updated: number;
}

export interface EpicResyncResult {
  imported: number;

  totalGames: number;

  updated: number;
}

export interface ApiResponse<T> {
  Status: string;

  Data: T;

  Message?: string;
}