import { Box, Button, Flex, SimpleGrid, Spinner, Text } from "@chakra-ui/react";

import StatusFilter from "../components/StatusFilter";
import GameCard from "../components/GameCard";

import type { Game, RawgGameResult, Status } from "../types/library";

import type { Collection } from "../../collections/types/collection";

interface Props {
  selectedGameId?: string | null;
  selectedStatus: string;

  onStatusChange: (status: string) => void;

  loading: boolean;

  error: string | null;

  filteredGames: Game[];

  collections: Collection[];

  onDeleteGame: (gameId: string) => void;

  onLaunch: (game: Game) => void;

  onReview: (game: Game) => void;

  onGameStatusChange: (gameId: string, status: Status) => void;

  onAddToCollection: (collectionId: string, gameId: string) => void;

  onOpenCollectionModal: () => void;
}

export default function LibraryGamesSection({
  selectedGameId,
  selectedStatus,
  onStatusChange,
  loading,
  error,
  filteredGames,
  collections,
  onDeleteGame,
  onLaunch,
  onReview,
  onGameStatusChange,
  onAddToCollection,
  onOpenCollectionModal,
}: Props) {
  return (
    <>
      <StatusFilter
        selectedStatus={selectedStatus}
        onStatusChange={onStatusChange}
      />

      <Flex mb={6}>
        <Button colorScheme="purple" onClick={onOpenCollectionModal}>
          New Collection
        </Button>
      </Flex>

      {loading ? (
        <Box w="100%" py={10} textAlign="center" color="gray.500" fontSize="lg">
          <Spinner size="xl" thickness="4px" speed="0.6s" />

          <Text mt={4}>Loading your library...</Text>
        </Box>
      ) : error ? (
        <Box
          w="100%"
          py={10}
          textAlign="center"
          color="red.400"
          fontSize="md"
          borderWidth="1px"
          borderColor="red.300"
          borderRadius="lg"
          bg="red.50"
          _dark={{
            bg: "red.900",
            borderColor: "red.700",
            color: "red.200",
          }}
        >
          <Text fontWeight="semibold">Something went wrong!</Text>

          <Text>{error}</Text>
        </Box>
      ) : filteredGames.length === 0 ? (
        <Box
          p={6}
          borderWidth="1px"
          borderStyle="dashed"
          borderRadius="lg"
          textAlign="center"
        >
          <Text>No games found.</Text>
        </Box>
      ) : (
        <SimpleGrid
          columns={{
            base: 1,
            sm: 2,
            md: 3,
          }}
          spacing={5}
        >
          {filteredGames.map((game) => (
            <GameCard
              key={game._id}
              game={game}
              collections={collections}
              onDelete={onDeleteGame}
              onStatusChange={onGameStatusChange}
              onLaunch={onLaunch}
              onReview={onReview}
              onAddToCollection={onAddToCollection}
              isHighlighted={game._id === selectedGameId}
            />
          ))}
        </SimpleGrid>
      )}
    </>
  );
}
