import { Button, useColorModeValue, useToast } from "@chakra-ui/react";
import { FaSteam } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";
import ProviderCard from "../../components/ProviderCard";
import { useProvider } from "../../context/ProviderContext";

export default function SteamProviderCard() {
  const { provider, connectionState, loading, disconnect, resync, authenticate } = useProvider("steam");
  const toast = useToast();
  const mutedButton = useColorModeValue("gray.600", "gray.400");

  const isConnected = provider.connected && ["connected", "syncing", "disconnecting"].includes(connectionState);

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
    // "Couldn't connect" status -- no toast needed for them.
  };

  return (
    <ProviderCard
      title="Steam"
      icon={<FaSteam size={20} />}
      connected={provider.connected}
      connectionState={connectionState}
      displayName={provider.displayName}
      lastSync={provider.lastSync}
      importedGames={provider.importedGames}
      loading={loading}
      description="Imports your whole Steam library, including games you haven't installed, and shows which ones are on this PC."
    >
      {isConnected ? (
        <>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<FiRefreshCw />}
            onClick={resync}
            isLoading={connectionState === "syncing"}
            isDisabled={loading}
            loadingText="Syncing"
          >
            Resync library
          </Button>

          <Button
            size="sm"
            variant="ghost"
            color={mutedButton}
            onClick={disconnect}
            isLoading={connectionState === "disconnecting"}
            isDisabled={loading}
            loadingText="Disconnecting"
          >
            Disconnect
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          colorScheme="purple"
          onClick={handleConnect}
          isLoading={loading || connectionState === "connecting"}
          loadingText={connectionState === "syncing" ? "Importing" : "Connecting"}
        >
          Connect Steam
        </Button>
      )}
    </ProviderCard>
  );
}
