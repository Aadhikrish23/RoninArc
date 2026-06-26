import { Button, VStack } from "@chakra-ui/react";
import { SiEpicgames } from "react-icons/si";
import ProviderCard from "../../components/ProviderCard";
import useEpic from "../hooks/useEpic";
import EpicConnectButton from "./EpicConnectButton";

export default function EpicProviderCard() {
  const { provider, connectionState, loading, disconnect, resync } = useEpic();

  const isConnected = ["connected", "syncing"].includes(connectionState);

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
            colorScheme="blue"
            onClick={resync}
            isLoading={loading || connectionState === "syncing"}
            loadingText="Syncing..."
          >
            Resync Library
          </Button>

          <Button
            variant="outline"
            colorScheme="red"
            onClick={disconnect}
            isLoading={loading || connectionState === "disconnecting"}
            loadingText="Disconnecting..."
          >
            Disconnect
          </Button>
        </>
      ) : (
        <VStack align="stretch" spacing={3} w="100%">
          <EpicConnectButton isLoading={loading || connectionState === "connecting"} />
        </VStack>
      )}
    </ProviderCard>
  );
}