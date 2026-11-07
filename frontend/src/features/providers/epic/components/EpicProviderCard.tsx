import { Button, VStack } from "@chakra-ui/react";
import { SiEpicgames } from "react-icons/si";
import ProviderCard from "../../components/ProviderCard";
import useEpic from "../hooks/useEpic";
import EpicConnectButton from "./EpicConnectButton";

export default function EpicProviderCard() {
  const { provider, connectionState, loading, disconnect, resync } = useEpic();

  const isConnected = provider.connected && ["connected", "syncing", "disconnecting"].includes(connectionState);

  return (
    <ProviderCard
      title="Epic Games"
      icon={<SiEpicgames size={22} />}
      connected={provider.connected}
      connectionState={connectionState}
      displayName={provider.displayName}
      lastSync={provider.lastSync}
      importedGames={provider.importedGames}
      loading={loading}
      description="Connect your Epic Games account to automatically import your library and synchronize metadata."
    >
      {isConnected ? (
        <>
          <Button
            colorScheme="purple"
            onClick={resync}
            isLoading={connectionState === "syncing"}
            isDisabled={loading}
            loadingText="Syncing..."
          >
            Resync Library
          </Button>

          <Button
            variant="outline"
            colorScheme="red"
            onClick={disconnect}
            isLoading={connectionState === "disconnecting"}
            isDisabled={loading}
            loadingText="Disconnecting..."
          >
            Disconnect
          </Button>
        </>
      ) : (
        <VStack align="stretch" spacing={3} w="100%">
          <EpicConnectButton
            isLoading={loading || connectionState === "connecting"}
            loadingText={connectionState === "syncing" ? "Importing..." : undefined}
          />
        </VStack>
      )}
    </ProviderCard>
  );
}