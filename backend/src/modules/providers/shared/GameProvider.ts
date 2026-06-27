export interface GameProvider {
  getStatus(userId: string): Promise<any>;
  connect(userId: string, body: any): Promise<any>;
  disconnect(userId: string): Promise<void>;
  resync(userId: string, body: any): Promise<any>;
  getLoginUrl?(userId: string): Promise<string>;
  refreshInstallations?(userId: string, localGames: any[]): Promise<any>;
}

