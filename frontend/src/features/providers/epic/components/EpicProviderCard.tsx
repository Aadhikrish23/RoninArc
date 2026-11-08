import { Button, useColorModeValue } from "@chakra-ui/react";
import { SiEpicgames } from "react-icons/si";
import { FiRefreshCw } from "react-icons/fi";
import ProviderCard from "../../components/ProviderCard";
import useEpic from "../hooks/useEpic";
import EpicConnectButton from "./EpicConnectButton";

export default function EpicProviderCard() {
  const { provider, connectionState, loading, disconnect, resync } = useEpic();
  const mutedButton = useColorModeValue("gray.600", "gray.400");

  const isConnected = provider.connected && ["connected", "syncing", "disconnecting"].includes(connectionState);

  return (
    <ProviderCard
      title="Epic Games"
      icon={<SiEpicgames size={20} />}
      connected={provider.connected}
      connectionState={connectionState}
      displayName={provider.displayName}
      lastSync={provider.lastSync}
      importedGames={provider.importedGames}
      loading={loading}
      description="Imports your Epic library and keeps its details up to date."
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
        <EpicConnectButton
          isLoading={loading || connectionState === "connecting"}
          loadingText={connectionState === "syncing" ? "Importing" : undefined}
        />
      )}
    </ProviderCard>
  );
}