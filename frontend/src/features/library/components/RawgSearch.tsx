import {
  Box,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  Text,
  VStack,
  Flex,
  Button,
  Spinner,
  HStack,
  useColorModeValue,
} from "@chakra-ui/react";

import { SearchIcon } from "@chakra-ui/icons";

import type {
  RawgGameResult,
} from "../types/library";

interface RawgSearchProps {
  searchText: string;

  onSearchChange: (
    value: string
  ) => void;

  results: RawgGameResult[];

  loading: boolean;

  error: string | null;

  onAddGame: (
    game: RawgGameResult
  ) => void;
}

export default function RawgSearch({
  searchText,
  onSearchChange,
  results,
  loading,
  error,
  onAddGame,
}: RawgSearchProps) {
  const cardBg = useColorModeValue(
    "white",
    "gray.800"
  );

  const subtleBorder = useColorModeValue(
    "gray.200",
    "gray.700"
  );

  return (
    <>
      <Box mb={6}>
        <InputGroup size="lg">
          <InputLeftElement>
            <Icon
              as={SearchIcon}
              color="gray.400"
            />
          </InputLeftElement>

          <Input
            placeholder="Search games to add from RAWG..."
            value={searchText}
            onChange={(e) =>
              onSearchChange(e.target.value)
            }
            borderRadius="xl"
            bg={cardBg}
            borderColor={subtleBorder}
          />
        </InputGroup>
      </Box>

      <Box mb={6}>
        {loading ? (
          <HStack
            spacing={2}
            p={3}
            borderWidth="1px"
            borderRadius="md"
            borderColor={subtleBorder}
            bg={cardBg}
          >
            <Spinner size="sm" />
            <Text fontSize="sm" color="gray.500">
              Searching RAWG...
            </Text>
          </HStack>
        ) : error ? (
          <Box
            p={3}
            borderWidth="1px"
            borderRadius="md"
            borderColor="red.300"
            bg="red.50"
          >
            <Text
              fontSize="sm"
              color="red.500"
            >
              {error}
            </Text>
          </Box>
        ) : results.length > 0 ? (
          <Box
            p={3}
            borderWidth="1px"
            borderRadius="md"
            borderColor={subtleBorder}
            bg={cardBg}
            maxH="260px"
            overflowY="auto"
          >
            <Text
              fontSize="sm"
              mb={2}
              color="gray.500"
            >
              RAWG results:
            </Text>

            <VStack
              align="stretch"
              spacing={2}
            >
              {results.map((game) => (
                <Flex
                  key={game.id}
                  align="center"
                  justify="space-between"
                  p={2}
                  borderRadius="md"
                >
                  <Box>
                    <Text
                      fontSize="sm"
                      fontWeight="semibold"
                    >
                      {game.name}
                    </Text>

                    <Text
                      fontSize="xs"
                      color="gray.500"
                    >
                      {game.genres.join(", ")}
                    </Text>
                  </Box>

                  <Button
                    size="xs"
                    colorScheme="purple"
                    variant="outline"
                    onClick={() =>
                      onAddGame(game)
                    }
                  >
                    Add
                  </Button>
                </Flex>
              ))}
            </VStack>
          </Box>
        ) : null}
      </Box>
    </>
  );
}