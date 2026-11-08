import { HStack, Skeleton, Stack } from "@chakra-ui/react";

import type { ProviderCardProps } from "../types/provider";
import ProviderStatusBadge from "./ProviderStatusBadge";
import { IconTile, SettingsRow } from "../../settings/components/SettingsLayout";

/** "today, 14:32", "yesterday, 09:10", or the date. */
function syncedWhen(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(new Date()) - day(at)) / 86_400_000);
  if (days === 0) return `today, ${time}`;
  if (days === 1) return `yesterday, ${time}`;
  return at.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/** One store in Game sources: its logo, whether it's connected, and its buttons. */
export default function ProviderCard({
  title,
  icon,
  connected,
  connectionState,
  displayName,
  lastSync,
  importedGames,
  description,
  loading = false,
  children,
}: ProviderCardProps) {
  // Loading has highest priority: never infer connected/disconnected while loading.
  const isStateLoading = connectionState === "loading" || (loading && !connectionState);
  const stateConnected = isStateLoading
    ? false
    : connectionState
      ? connected && ["connected", "syncing", "connecting", "disconnecting"].includes(connectionState)
      : connected;
  const isSyncing = connectionState === "syncing";
  const syncingNote = "Importing your games. A big library can take a minute or two, and you can keep using RoninArc meanwhile.";

  const facts = [
    displayName,
    importedGames !== undefined ? `${importedGames} ${importedGames === 1 ? "game" : "games"}` : null,
    lastSync ? `last synced ${syncedWhen(lastSync)}` : null,
  ].filter(Boolean);

  const detail = isStateLoading ? (
    <Skeleton height="14px" width="220px" mt={1} />
  ) : stateConnected ? (
    <Stack spacing={0.5}>
      <span>{facts.join(" · ")}</span>
      {isSyncing && <span aria-live="polite">{syncingNote}</span>}
    </Stack>
  ) : (
    <span aria-live="polite">{isSyncing ? syncingNote : description || "Not connected yet."}</span>
  );

  return (
    <SettingsRow
      lead={icon ? <IconTile>{icon}</IconTile> : undefined}
      label={title}
      status={isStateLoading ? undefined : <ProviderStatusBadge connected={connected} connectionState={connectionState} />}
      detail={detail}
      actions={
        children &&
        (isStateLoading ? (
          <Skeleton height="32px" width="120px" rounded="md" />
        ) : (
          <HStack spacing={2}>{children}</HStack>
        ))
      }
    />
  );
}
