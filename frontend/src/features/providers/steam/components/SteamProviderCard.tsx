import { Button, VStack, useToast } from "@chakra-ui/react";
import { FaSteam } from "react-icons/fa";
import ProviderCard from "../../components/ProviderCard";
import { useProvider } from "../../context/ProviderContext";

export default function SteamProviderCard() {
  const { provider, connectionState, loading, disconnect, resync, authenticate } = useProvider("steam");
  const toast = useToast();

  const isConnected = ["connected", "syncing"].includes(connectionState);

  const handleConnect = async () => {
    const result = await authenticate();

    if (result.connected) {
      toast({
        title: "Steam Connected",
        description: `Imported ${result.importedGames ?? 0} game(s) from your local Steam library.`,
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    }
    // Errors (e.g. not running in the desktop app) are surfaced by the
    // "Error" status badge -- no toast needed for them.
  };

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
            onClick={handleConnect}
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
