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
        description: `Imported ${result.importedGames ?? 0} game(s) from your Steam library.`,
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
      description="Sign in with Steam to import your full library -- including games you haven't installed -- and detect which ones are installed on this PC."
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
