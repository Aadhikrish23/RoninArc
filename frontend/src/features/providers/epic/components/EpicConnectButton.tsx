import { Button, useToast } from "@chakra-ui/react";
import useEpic from "../hooks/useEpic";

interface Props {
  isLoading?: boolean;
}

/**
 * Connect button for Epic Games.
 *
 * This component contains zero runtime-branching.
 * It has no knowledge of whether it is running inside Electron or a browser.
 *
 * It calls useEpic().authenticate() — the hook resolves the correct strategy
 * and orchestrates everything from code acquisition to library synchronisation.
 */
export default function EpicConnectButton({ isLoading: parentLoading }: Props) {
  const { authenticate, loading } = useEpic();
  const toast = useToast();

  const handleClick = async () => {
    const result = await authenticate();

    if (result.connected) {
      toast({
        title:       "Epic Games Connected",
        description: `Welcome, ${result.displayName ?? "Epic User"}! Your library is syncing.`,
        status:      "success",
        duration:    4000,
        isClosable:  true,
      });
    }
    // Errors / cancellations are surfaced by the strategy (modal / console) and
    // by useEpic's internal `error` state — no need to toast here for them.
  };

  return (
    <Button
      id="epic-connect-button"
      colorScheme="blue"
      onClick={handleClick}
      isLoading={loading || parentLoading}
      loadingText="Connecting..."
      w="100%"
    >
      Connect Epic Games
    </Button>
  );
}
