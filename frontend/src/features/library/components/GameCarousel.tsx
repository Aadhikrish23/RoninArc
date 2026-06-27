import { HStack, Box, Text } from "@chakra-ui/react";
import GameCard from "./GameCard";
import type { Game, Status } from "../types/library";
import type { Collection } from "../../collections/types/collection";

interface GameCarouselProps {
  games: Game[];
  
  onLaunch: (game: Game) => void;
  onStatusChange: (id: string, status: Status) => void;
  emptyMessage?: string;
  runningGames: Set<string>;
}

export default function GameCarousel({
  games,
  
  onLaunch,
  
  onStatusChange,
  emptyMessage = "No games in this section",
  runningGames,
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
            onLaunch={onLaunch}
            onStatusChange={onStatusChange}
            isRunning={runningGames.has(game._id)}
          />
        </Box>
      ))}
    </HStack>
  );
}
