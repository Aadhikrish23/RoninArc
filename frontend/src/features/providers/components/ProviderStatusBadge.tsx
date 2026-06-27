import { Badge, Spinner, HStack } from "@chakra-ui/react";
import type { ProviderConnectionState } from "../types/provider";

interface Props {
  connected: boolean;
  connectionState?: ProviderConnectionState;
}

export default function ProviderStatusBadge({
  connected,
  connectionState,
}: Props) {
  // connectionState (UI lifecycle) always takes priority when provided.
  // Only fall back to the connected boolean when connectionState is undefined.
  const state = connectionState ?? (connected ? "connected" : "disconnected");


  let colorScheme = "gray";
  let label = "Disconnected";

  switch (state) {
    case "loading":
      return <Spinner size="xs" color="blue.500" />;
    case "connecting":
      colorScheme = "blue";
      label = "Connecting";
      break;
    case "syncing":
      colorScheme = "teal";
      label = "Syncing";
      break;
    case "disconnecting":
      colorScheme = "orange";
      label = "Disconnecting";
      break;
    case "connected":
      colorScheme = "green";
      label = "Connected";
      break;
    case "error":
      colorScheme = "red";
      label = "Error";
      break;
    case "disconnected":
    default:
      colorScheme = "gray";
      label = "Disconnected";
      break;
  }

  const isInProgress = ["connecting", "syncing", "disconnecting"].includes(state);

  return (
    <Badge
      px={3}
      py={1}
      rounded="full"
      colorScheme={colorScheme}
    >
      <HStack spacing={1} display="inline-flex" align="center">
        {isInProgress && <Spinner size="xs" speed="0.8s" />}
        <span>{label}</span>
      </HStack>
    </Badge>
  );
}