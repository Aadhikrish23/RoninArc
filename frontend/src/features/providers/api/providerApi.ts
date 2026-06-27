import api from "../../../shared/api/axiosInstance";
import type { ProviderId, ProviderStatus } from "../types/provider";

export interface ProviderBackendStatus {
  connected: boolean;
  displayName: string | null;
  connectedAt: string | null;
  importedGames?: number;
  lastSync?: string | null;
}

const getStatus = async (providerId: ProviderId): Promise<ProviderStatus> => {
  const response = await api.get<{ Data: ProviderBackendStatus }>(
    `/provider/${providerId}/status`
  );
  const data = response.data.Data;
  return {
    provider: providerId,
    connected: data.connected,
    displayName: data.displayName,
    importedGames: data.importedGames || 0,
    lastSync: data.lastSync || data.connectedAt,
  };
};

const getOAuthUrl = async (providerId: ProviderId): Promise<string> => {
  const response = await api.get<{ Data: { loginUrl: string } }>(
    `/provider/${providerId}/oauth/start`
  );
  return response.data.Data.loginUrl;
};

const connect = async (
  providerId: ProviderId,
  payload: any
): Promise<ProviderStatus> => {
  const response = await api.post<{ Data: any }>(
    `/provider/${providerId}/connect`,
    payload
  );
  const data = response.data.Data;
  return {
    provider: providerId,
    connected: data.connected,
    displayName: data.displayName,
    importedGames: data.totalGames,
    lastSync: new Date().toISOString(),
  };
};

const resync = async (providerId: ProviderId, payload: any): Promise<any> => {
  const response = await api.post<{ Data: any }>(
    `/provider/${providerId}/resync`,
    payload
  );
  return response.data.Data;
};

const disconnect = async (providerId: ProviderId): Promise<void> => {
  await api.delete(`/provider/${providerId}/disconnect`);
};

const refreshInstallations = async (installations: { steam: any[]; epic: any[] }): Promise<any> => {
  const response = await api.post<{ Data: any }>(
    "/provider/installations/refresh",
    { installations }
  );
  return response.data.Data;
};

export default {
  getStatus,
  getOAuthUrl,
  connect,
  resync,
  disconnect,
  refreshInstallations,
};

