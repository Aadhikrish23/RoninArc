import type { ReactNode } from "react";

export type ProviderId = "manual" | "epic" | "steam" | "gog" | "ea" | "ubisoft" | "xbox";

export type ProviderConnectionState =
  | "loading"
  | "connecting"
  | "connected"
  | "syncing"
  | "disconnecting"
  | "disconnected"
  | "error";

export interface ProviderStatus {
  provider: ProviderId;
  connected: boolean;
  displayName?: string | null;
  importedGames: number;
  lastSync?: string | null;
}

export interface ProviderCardProps {
  title: string;

  icon?: ReactNode;

  connected: boolean;

  connectionState?: ProviderConnectionState;

  displayName?: string | null;

  lastSync?: string | null;

  importedGames?: number;

  description?: string | null;

  loading?: boolean;

  children?: ReactNode;
}