import { Button, VStack } from "@chakra-ui/react";
import { FaSteam } from "react-icons/fa";
import ProviderCard from "../../components/ProviderCard";
import { useProvider } from "../../context/ProviderContext";

export default function SteamProviderCard() {
  const { provider, connectionState, loading, disconnect, resync, authenticate } = useProvider("steam");

  const isConnected = ["connected", "syncing"].includes(connectionState);

  return (
    <ProviderCard
      title="Steam"
      icon={<FaSteam size={22} />}
      connected={provider.connected}
      connectionState={connectionState}
      displayName={provider.displayName}
      lastSync={provider.lastSync}
      importedGames={provider.importedGames}
      loading={loading}
      description="Sync your locally installed Steam games automatically by scanning your Steam library directories."
    >
      {isConnected ? (
        <>
          <Button
            colorScheme="blue"
            onClick={resync}
            isLoading={loading || connectionState === "syncing"}
            loadingText="Syncing..."
          >
            Scan & Sync Library
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
          <Button
            colorScheme="purple"
            onClick={() => authenticate()}
            isLoading={loading || connectionState === "connecting"}
            loadingText="Connecting..."
          >
            Connect Steam
          </Button>
        </VStack>
      )}
    </ProviderCard>
  );
}
