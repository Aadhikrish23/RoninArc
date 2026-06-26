import { HStack, Box, Text } from "@chakra-ui/react";
import GameCard from "./GameCard";
import type { Game, Status } from "../types/library";
import type { Collection } from "../../collections/types/collection";

interface GameCarouselProps {
  games: Game[];
  collections: Collection[];
  onLaunch: (game: Game) => void;
  onReview: (game: Game) => void;
  onDelete: (id: string) => void;
  onAddToCollection: (collectionId: string, gameId: string) => void;
  onStatusChange: (id: string, status: Status) => void;
  emptyMessage?: string;
}

export default function GameCarousel({
  games,
  collections,
  onLaunch,
  onReview,
  onDelete,
  onAddToCollection,
  onStatusChange,
  emptyMessage = "No games in this section",
}: GameCarouselProps) {
  if (games.length === 0) {
    return (
      <Text color="gray.500" py={4}>
        {emptyMessage}
      </Text>
    );
  }

  return (
    <HStack spacing={6} align="stretch" pb={4}>
      {games.map((game) => (
        <Box key={game._id} minW="280px" maxW="280px">
          <GameCard
            game={game}
            collections={collections}
            onLaunch={onLaunch}
            onReview={onReview}
            onDelete={onDelete}
            onAddToCollection={onAddToCollection}
            onStatusChange={onStatusChange}
          />
        </Box>
      ))}
    </HStack>
  );
}
