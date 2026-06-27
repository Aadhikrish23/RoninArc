import {
  Box,
  Button,
  Flex,
  Image,
  Spinner,
  Text,
  VStack,
  Heading,
} from "@chakra-ui/react";

import type { Game, RawgGameResult } from "../types/library";
import { Grid, IconButton } from "@chakra-ui/react";

import { RxHamburgerMenu } from "react-icons/rx";
import { BsGrid3X3Gap } from "react-icons/bs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  searchText: string;
  ownedResults: Game[];
  discoverResults: RawgGameResult[];
  loading: boolean;
  error: string | null;
  onAddGame: (game: RawgGameResult) => Promise<void>;
  onLaunchGame: (game: Game) => void;
  onBack: () => void;
}

export default function RawgResultsSection({
  searchText,
  ownedResults,
  discoverResults,
  loading,
  error,
  onAddGame,
  onLaunchGame,
  onBack,
}: Props) {
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const navigate = useNavigate();

  const renderOwnedGrid = (game: Game) => {
    const isOwned = game.providers && Object.keys(game.providers).length > 0;
    const isInstalled = isOwned && Object.values(game.providers || {}).some((p: any) => p.installed === true);
    const disableLaunch = isOwned && !isInstalled;

    return (
      <Box
        key={game._id}
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        cursor="pointer"
        onClick={() => navigate(`/library/game/${game._id}`)}
        _hover={{ shadow: "md" }}
      >
        <Image
          src={game.imageURL || "https://placehold.co/120x80?text=No+Image"}
          h="180px"
          w="100%"
          objectFit="cover"
        />
        <Box p={4}>
          <Text fontWeight="bold" noOfLines={1}>
            {game.title}
          </Text>
          <Text color="gray.500" fontSize="sm">
            {game.developer || "Unknown Developer"}
          </Text>
          <Text color="gray.500" fontSize="sm" noOfLines={1}>
            {game.tags.join(", ")}
          </Text>
          <Button
            mt={3}
            w="100%"
            colorScheme={disableLaunch ? "gray" : "purple"}
            isDisabled={disableLaunch}
            onClick={(e) => {
              e.stopPropagation();
              onLaunchGame(game);
            }}
          >
            {disableLaunch ? "Not Installed" : "Launch"}
          </Button>
        </Box>
      </Box>
    );
  };

  const renderOwnedList = (game: Game) => {
    const isOwned = game.providers && Object.keys(game.providers).length > 0;
    const isInstalled = isOwned && Object.values(game.providers || {}).some((p: any) => p.installed === true);
    const disableLaunch = isOwned && !isInstalled;

    return (
      <Flex
        key={game._id}
        gap={4}
        p={4}
        borderWidth="1px"
        borderRadius="lg"
        align="center"
        cursor="pointer"
        transition="all .2s"
        _hover={{
          transform: "translateY(-2px)",
          shadow: "md",
        }}
        onClick={() => navigate(`/library/game/${game._id}`)}
      >
        <Image
          src={game.imageURL || "https://placehold.co/120x80?text=No+Image"}
          alt={game.title}
          boxSize="140px"
          objectFit="cover"
          borderRadius="md"
        />
        <Box flex={1}>
          <Text fontWeight="bold" fontSize="lg">
            {game.title}
          </Text>
          <Text color="gray.500" mt={1}>
            {game.developer || "Unknown Developer"}
          </Text>
          <Text color="gray.500" mt={1}>
            {game.tags.join(", ")}
          </Text>
          <Text color="gray.500" mt={1}>
            Provider: {game.provider ? game.provider.toUpperCase() : "MANUAL"}
          </Text>
        </Box>
        <Button
          colorScheme={disableLaunch ? "gray" : "purple"}
          isDisabled={disableLaunch}
          onClick={(e) => {
            e.stopPropagation();
            onLaunchGame(game);
          }}
        >
          {disableLaunch ? "Not Installed" : "Launch"}
        </Button>
      </Flex>
    );
  };

  const renderDiscoverGrid = (game: RawgGameResult) => (
    <Box
      key={game.id}
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      cursor="pointer"
      onClick={() => navigate(`/library/game/${game.id}`)}
      _hover={{ shadow: "md" }}
    >
      <Image
        src={game.imageURL || "https://placehold.co/120x80?text=No+Image"}
        h="180px"
        w="100%"
        objectFit="cover"
      />
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
          onClick={(e) => {
            e.stopPropagation();
            onAddGame(game);
          }}
        >
          Add
        </Button>
      </Box>
    </Box>
  );

  const renderDiscoverList = (game: RawgGameResult) => (
    <Flex
      key={game.id}
      gap={4}
      p={4}
      borderWidth="1px"
      borderRadius="lg"
      align="center"
      cursor="pointer"
      transition="all .2s"
      _hover={{
        transform: "translateY(-2px)",
        shadow: "md",
      }}
      onClick={() => navigate(`/library/game/${game.id}`)}
    >
      <Image
        src={game.imageURL || "https://placehold.co/120x80?text=No+Image"}
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
      <Button
        colorScheme="purple"
        onClick={(e) => {
          e.stopPropagation();
          onAddGame(game);
        }}
      >
        Add
      </Button>
    </Flex>
  );

  if (loading) {
    return (
      <Box textAlign="center" py={10}>
        <Spinner size="xl" />
      </Box>
    );
  }

  const noResults = ownedResults.length === 0 && discoverResults.length === 0;

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

          <Button size="sm" variant="link" onClick={onBack}>
            ← Back To Library
          </Button>
        </Flex>

        {/* View Toggle Row */}
        {!noResults && (
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
        )}
      </Box>

      {error ? (
        <Text color="red.500">{error}</Text>
      ) : noResults ? (
        <Text color="gray.500" textAlign="center" py={10}>
          No games found matching "{searchText}".
        </Text>
      ) : (
        <VStack spacing={6} align="stretch">
          {/* Section 1: In Your Library */}
          {ownedResults.length > 0 && (
            <Box>
              <Heading size="md" mb={4} color="purple.300">
                In Your Library ({ownedResults.length})
              </Heading>
              {viewMode === "list" ? (
                <VStack spacing={4} align="stretch">
                  {ownedResults.map(renderOwnedList)}
                </VStack>
              ) : (
                <Grid
                  templateColumns="repeat(auto-fill,minmax(250px,1fr))"
                  gap={5}
                >
                  {ownedResults.map(renderOwnedGrid)}
                </Grid>
              )}
            </Box>
          )}

          {/* Section 2: Discover Games */}
          {discoverResults.length > 0 && (
            <Box>
              <Heading size="md" mb={4} color="purple.300" mt={4}>
                Discover Games ({discoverResults.length})
              </Heading>
              {viewMode === "list" ? (
                <VStack spacing={4} align="stretch">
                  {discoverResults.map(renderDiscoverList)}
                </VStack>
              ) : (
                <Grid
                  templateColumns="repeat(auto-fill,minmax(250px,1fr))"
                  gap={5}
                >
                  {discoverResults.map(renderDiscoverGrid)}
                </Grid>
              )}
            </Box>
          )}
        </VStack>
      )}
    </Box>
  );
}
