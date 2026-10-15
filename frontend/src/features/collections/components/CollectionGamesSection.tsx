import { useNavigate } from "react-router-dom";
import { SimpleGrid, VStack, HStack, IconButton, Box, Button, Heading, Text } from "@chakra-ui/react";

import { useState } from "react";

import { BsGrid3X3Gap } from "react-icons/bs";
import { RxHamburgerMenu } from "react-icons/rx";

import CollectionGameCard from "./CollectionGameCard";
import GameListRow from "../../library/components/GameListRow";

import type { Game, Status } from "../../library/types/library";

interface Props {
  games: Game[];

  onLaunch?: (game: Game) => void;

  onStatusChange?: (id: string, status: Status) => void;

  collectionId: string;

  onRemove: ( gameId: string) => void;
  runningGames: Set<string>;
}

export default function CollectionGamesSection({
  games,
  collectionId,
  onLaunch = () => {},
  onStatusChange = () => {},
  onRemove,
  runningGames,
}: Props) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const navigate = useNavigate();

  if (games.length === 0) {
    return (
      <Box borderWidth="1px" borderStyle="dashed" borderRadius="xl" p={10} textAlign="center">
        <Heading size="sm" mb={2}>
          No games here yet
        </Heading>
        <Text color="gray.500" mb={5}>
          Open any game from your library and use "Add To Collection", or ask the AI assistant: "add Hades to this collection".
        </Text>
        <Button colorScheme="purple" onClick={() => navigate("/library/browse")}>
          Browse your library
        </Button>
      </Box>
    );
  }

  return (
    <>
      <HStack justify="flex-end" mb={6}>
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
      </HStack>

      {viewMode === "grid" ? (
        <SimpleGrid
          columns={{
            base: 1,
            sm: 2,
            md: 3,
            xl: 4,
          }}
          spacing={7}
        >
          {games.map((game) => (
            <CollectionGameCard
              key={game._id}
              game={game}
              collectionId={collectionId}
              onLaunch={onLaunch}
              onStatusChange={onStatusChange}
              onRemove={onRemove}
              isRunning={runningGames.has(game._id)}
            />
          ))}
        </SimpleGrid>
      ) : (
        <VStack spacing={4} align="stretch">
          {games.map((game) => (
            <GameListRow
              key={game._id}
              game={game}
              onLaunch={onLaunch}
              onStatusChange={onStatusChange}
              isRunning={runningGames.has(game._id)}
            />
          ))}
        </VStack>
      )}
    </>
  );
}
