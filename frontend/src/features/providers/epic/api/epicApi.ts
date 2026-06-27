import providerApi from "../../api/providerApi";
import type { ProviderStatus } from "../../types/provider";
import type { EpicConnectPayload, EpicResyncResult } from "../types/epic";

const getStatus = (): Promise<ProviderStatus> => providerApi.getStatus("epic");
const getOAuthUrl = (): Promise<string> => providerApi.getOAuthUrl("epic");
const connect = (payload: EpicConnectPayload): Promise<ProviderStatus> => providerApi.connect("epic", payload);
const resync = (): Promise<EpicResyncResult> => providerApi.resync("epic", {});
const disconnect = (): Promise<void> => providerApi.disconnect("epic");

export default {
  getStatus,
  getOAuthUrl,
  connect,
  resync,
  disconnect,
};