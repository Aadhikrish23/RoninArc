import {
  Box,
  Button,
  Flex,
  Image,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";

import type { RawgGameResult } from "../types/library";
import { Grid, IconButton } from "@chakra-ui/react";

import { RxHamburgerMenu } from "react-icons/rx";
import { BsGrid3X3Gap } from "react-icons/bs";
import { useState } from "react";
import { useMemo } from "react";
import { rankSearchResults } from "../utils/searchRanking";

interface Props {
  searchText: string;

  results: RawgGameResult[];

  loading: boolean;

  error: string | null;

  onAddGame: (game: RawgGameResult) => Promise<void>;

  onBack: () => void;
}

export default function RawgResultsSection({
  searchText,
  results,
  loading,
  error,
  onAddGame,
  onBack,
}: Props) {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const renderGrid = (game: RawgGameResult) => (
    <Box key={game.id} borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Image src={game.imageURL} h="180px" w="100%" objectFit="cover" />

      <Box p={4}>
        <Text fontWeight="bold" noOfLines={1}>
          {game.name}
        </Text>

        <Text color="gray.500" fontSize="sm">
          ⭐ {game.rating}
        </Text>

        <Text color="gray.500" fontSize="sm" noOfLines={1}>
          {game.genres.join(", ")}
        </Text>

        <Button
          mt={3}
          w="100%"
          colorScheme="purple"
          onClick={() => onAddGame(game)}
        >
          Add
        </Button>
      </Box>
    </Box>
  );
  const renderList = (game: RawgGameResult) => (
    <Flex
      key={game.id}
      gap={4}
      p={4}
      borderWidth="1px"
      borderRadius="lg"
      align="center"
    >
      <Image
        src={game.imageURL}
        alt={game.name}
        boxSize="140px"
        objectFit="cover"
        borderRadius="md"
      />

      <Box flex={1}>
        <Text fontWeight="bold" fontSize="lg">
          {game.name}
        </Text>

        <Text color="gray.500" mt={1}>
          ⭐ {game.rating}
        </Text>

        <Text color="gray.500" mt={1}>
          {game.genres.join(", ")}
        </Text>

        <Text color="gray.500" mt={1}>
          {game.released ? new Date(game.released).getFullYear() : "Unknown"}
        </Text>
      </Box>

      <Button colorScheme="purple" onClick={() => onAddGame(game)}>
        Add
      </Button>
    </Flex>
  );
  const rankedResults = useMemo(
    () => rankSearchResults(results, searchText),
    [results, searchText],
  );
  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    );
  }

  return (
    <Box>
      <Box mb={6} width="100%">
        {/* Header Row: Title on Left, Button on Right */}
        <Flex justify="space-between" align="center" mb={4}>
          <Box>
            <Text fontSize="2xl" fontWeight="bold">
              Search Results
            </Text>
            <Text color="gray.500">"{searchText}"</Text>
          </Box>

          <Button size="sm" variant="link"  onClick={onBack}>
            ← Back To Library
          </Button>
        </Flex>

        {/* View Toggle Row: Aligned Left beneath the text, matching the image layout */}
        <Flex justify="flex-end" gap={2} pl={1}>
          <IconButton
            aria-label="List View"
            icon={<RxHamburgerMenu />}
            colorScheme={viewMode === "list" ? "purple" : undefined}
            onClick={() => setViewMode("list")}
          />

          <IconButton
            aria-label="Grid View"
            icon={<BsGrid3X3Gap />}
            colorScheme={viewMode === "grid" ? "purple" : undefined}
            onClick={() => setViewMode("grid")}
          />
        </Flex>
      </Box>

      {error ? (
        <Text color="red.500">{error}</Text>
      ) : (
        <VStack spacing={4} align="stretch">
          {viewMode === "list" ? (
            <VStack spacing={4} align="stretch">
              {rankedResults.map(renderList)}
            </VStack>
          ) : (
            <Grid
              templateColumns="repeat(auto-fill,minmax(250px,1fr))  "
              gap={5}
            >
              {rankedResults.map(renderGrid)}
            </Grid>
          )}
        </VStack>
      )}
    </Box>
  );
}
