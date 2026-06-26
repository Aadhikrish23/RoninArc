import {
  Box,
  ButtonGroup,
  Divider,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
  Skeleton,
  useColorModeValue,
} from "@chakra-ui/react";

import type { ProviderCardProps } from "../types/provider";
import ProviderStatusBadge from "./ProviderStatusBadge";


export default function ProviderCard({
  title,
  icon,
  connected,
  connectionState,
  displayName,
  lastSync,
  importedGames,
  description,
  loading = false,
  children,
}: ProviderCardProps) {
  const bg = useColorModeValue(
    "white",
    "gray.800"
  );

  const border = useColorModeValue(
    "gray.200",
    "gray.700"
  );

  const isStateLoading = connectionState === "loading" || (loading && !connectionState);
  const stateConnected = connectionState 
    ? ["connected", "syncing", "connecting", "disconnecting"].includes(connectionState)
    : connected;

  return (
    <Box
      bg={bg}
      borderWidth="1px"
      borderColor={border}
      rounded="xl"
      p={6}
      shadow="sm"
      transition="all .2s"
      _hover={{
        shadow: "md",
      }}
    >
      <VStack
        spacing={5}
        align="stretch"
      >
        {/* Header */}

        <HStack
          justify="space-between"
          align="center"
        >
          <HStack spacing={3}>
            {icon}

            <Heading size="md">
              {title}
            </Heading>
          </HStack>

          <ProviderStatusBadge
            connected={connected}
            connectionState={connectionState}
          />
        </HStack>

        <Divider />

        {/* Provider Info */}

        {isStateLoading ? (
          <VStack align="start" spacing={3} w="100%">
            <Skeleton height="15px" width="120px" />
            <Skeleton height="15px" width="80px" />
            <Skeleton height="15px" width="180px" />
          </VStack>
        ) : stateConnected ? (
          <VStack
            align="start"
            spacing={1}
          >
            <Text
              fontWeight="semibold"
            >
              Connected as
            </Text>

            <Text>
              {displayName || "..."}
            </Text>

            {importedGames !== undefined && (
              <Text fontSize="sm">
                Imported games: <strong>{importedGames}</strong>
              </Text>
            )}

            {lastSync && (
              <Text
                color="gray.500"
                fontSize="sm"
              >
                Last synced:{" "}
                {new Date(
                  lastSync
                ).toLocaleString()}
              </Text>
            )}
          </VStack>
        ) : (
          <Text color="gray.500">
            {description || "This provider has not been connected."}
          </Text>
        )}

        {children && (
          <>
            <Divider />

            {isStateLoading ? (
              <HStack spacing={3}>
                <Skeleton height="40px" width="130px" rounded="md" />
              </HStack>
            ) : (
              <ButtonGroup>
                {children}
              </ButtonGroup>
            )}
          </>
        )}
      </VStack>
    </Box>
  );
}