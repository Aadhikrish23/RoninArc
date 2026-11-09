import { useEffect, useState } from "react";
import { Box, Button, CloseButton, Flex, Icon, Text, useColorModeValue } from "@chakra-ui/react";
import { FiSmartphone } from "react-icons/fi";
import syncApi, { type SyncStatus } from "../api/syncApi";
import ConnectPhoneModal from "./ConnectPhoneModal";

const DISMISSED = "roninarc.phoneBannerDismissed";
const dismissed = () => {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
};

/**
 * "Get your library on your phone": once the library has games and no phone uses it yet. Opens
 * the QR code (linking this PC to the cloud first if needed). Closing it is remembered; Settings
 * keeps "Connect your phone".
 */
export default function PhoneBanner({ hasGames }: { hasGames: boolean }) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [hidden, setHidden] = useState(dismissed);
  const [open, setOpen] = useState(false);
  const bg = useColorModeValue("purple.50", "whiteAlpha.50");
  const border = useColorModeValue("purple.100", "whiteAlpha.100");
  const muted = useColorModeValue("gray.600", "gray.400");

  useEffect(() => {
    if (hidden || !hasGames) return;
    syncApi.status().then(setStatus).catch(() => setStatus(null));
  }, [hidden, hasGames]);

  if (hidden || !hasGames || !status?.available || (status.linked && status.phoneLinked)) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      /* not remembered */
    }
    setHidden(true);
  };

  return (
    <Box as="section" aria-label="Get your library on your phone" bg={bg} borderWidth="1px" borderColor={border} borderRadius="xl" px={5} py={4} mb={6}>
      <Flex align="center" gap={4} flexWrap={{ base: "wrap", md: "nowrap" }}>
        <Icon as={FiSmartphone} boxSize={6} color="purple.400" aria-hidden />
        <Box flex="1" minW="200px">
          <Text fontWeight="semibold">Get your library on your phone</Text>
          <Text fontSize="sm" color={muted}>
            Scan a code with the RoninArc app for Android and your games, notes and collections come along. No password to type.
          </Text>
        </Box>
        <Button size="sm" colorScheme="purple" onClick={() => setOpen(true)}>
          Show the code
        </Button>
        <CloseButton size="sm" aria-label="Hide this" onClick={close} />
      </Flex>
      <ConnectPhoneModal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          syncApi.status().then(setStatus).catch(() => {});
        }}
        onStatus={setStatus}
      />
    </Box>
  );
}
