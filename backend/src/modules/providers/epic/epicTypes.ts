export interface EpicProfile {
  epicAccountId: string;
  displayName: string;
}

export interface EpicTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
