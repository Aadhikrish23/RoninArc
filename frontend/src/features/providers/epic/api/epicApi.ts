import api from "../../../../shared/api/axiosInstance";
import type { ProviderStatus } from "../../types/provider";
import type {
  ApiResponse,
  EpicConnectPayload,
  EpicConnectResult,
  EpicResyncResult,
} from "../types/epic";

interface EpicBackendStatus {
  connected: boolean;
  displayName: string | null;
  connectedAt: string | null;
  importedGames?: number;
  lastSync?: string | null;
}

const getStatus = async (): Promise<ProviderStatus> => {
  const response = await api.get<ApiResponse<EpicBackendStatus>>(
    "/provider/epic/status"
  );
  const data = response.data.Data;
  return {
    provider: "epic",
    connected: data.connected,
    displayName: data.displayName,
    importedGames: data.importedGames || 0,
    lastSync: data.lastSync || data.connectedAt,
  };
};

const getOAuthUrl = async (): Promise<string> => {
  const response = await api.get<
    ApiResponse<{
      loginUrl: string;
    }>
  >("/provider/epic/oauth/start");
  return response.data.Data.loginUrl;
};

const connect = async (
  payload: EpicConnectPayload
): Promise<ProviderStatus> => {
  const response = await api.post<ApiResponse<EpicConnectResult>>(
    "/provider/epic/connect",
    payload
  );
  const data = response.data.Data;
  return {
    provider: "epic",
    connected: data.connected,
    displayName: data.displayName,
    importedGames: data.totalGames,
    lastSync: new Date().toISOString(),
  };
};

const resync = async (): Promise<EpicResyncResult> => {
  const response = await api.post<ApiResponse<EpicResyncResult>>(
    "/provider/epic/resync"
  );
  return response.data.Data;
};

const disconnect = async (): Promise<void> => {
  await api.delete("/provider/epic/disconnect");
};

export default {
  getStatus,
  getOAuthUrl,
  connect,
  resync,
  disconnect,
};