import { Box, Button, VStack } from "@chakra-ui/react";

import GameCard from "../../library/components/GameCard";

import type { Game, Status } from "../../library/types/library";

interface Props {
  game: Game;

  collectionId: string;

  onLaunch: (game: Game) => void;

  onStatusChange: (id: string, status: Status) => void;

  onRemove: ( gameId: string) => void;

  isRunning?: boolean;
}

export default function CollectionGameCard({
  game,
  collectionId,
  onLaunch,
  onStatusChange,
  onRemove,
  isRunning,
}: Props) {
  return (
    <VStack spacing={3} align="stretch">
      <GameCard
        game={game}
        onLaunch={onLaunch}
        onStatusChange={onStatusChange}
        isRunning={isRunning}
      />

      <Button
        colorScheme="red"
        variant="outline"
        onClick={() => onRemove(game._id)}
      >
        Remove From Collection
      </Button>
    </VStack>
  );
}
