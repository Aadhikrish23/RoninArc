import type { ProviderConnectionState } from "../types/provider";
import { StatusDot, type StatusTone } from "../../settings/components/SettingsLayout";

interface Props {
  connected: boolean;
  connectionState?: ProviderConnectionState;
}

const LOOK: Record<ProviderConnectionState, [StatusTone, string]> = {
  loading: ["busy", "Checking"],
  connecting: ["busy", "Connecting"],
  syncing: ["busy", "Syncing"],
  disconnecting: ["busy", "Disconnecting"],
  connected: ["ok", "Connected"],
  error: ["error", "Couldn't connect"],
  disconnected: ["off", "Not connected"],
};

export default function ProviderStatusBadge({ connected, connectionState }: Props) {
  // connectionState (UI lifecycle) wins; the connected flag is the fallback.
  const state = connectionState ?? (connected ? "connected" : "disconnected");
  const [tone, label] = LOOK[state] ?? LOOK.disconnected;
  return <StatusDot tone={tone}>{label}</StatusDot>;
}
