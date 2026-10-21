import {
  Box,
  Flex,
  Heading,
  Text,
  Badge,
  Button,
  HStack,
} from "@chakra-ui/react";

import type { Collection } from "../types/collection";
import CollectionCover from "./CollectionCover";

interface Props {
  collection: Collection;

  onEdit: () => void;

  onDelete: () => void;
}

export default function CollectionHero({
  collection,
  onEdit,
  onDelete,
}: Props) {
  const totalGames = collection.gameIds.length;

  const completed = collection.gameIds.filter(
    (g) => g.progressStatus === "completed",
  ).length;

  const playing = collection.gameIds.filter(
    (g) => g.progressStatus === "playing",
  ).length;

  const installed = collection.gameIds.filter(
    (g) => g.providers && Object.values(g.providers).some((p) => p.installed),
  ).length;
  return (
    <Flex gap={8} mb={8} align="center" wrap="wrap">
      <Box w="280px">
        <CollectionCover games={collection.gameIds} />
      </Box>

      <Box>
        <Heading mb={3}>{collection.name}</Heading>

        {collection.description && (
          <Text color="gray.500" mb={4}>
            {collection.description}
          </Text>
        )}

        <HStack spacing={3}>
          <Badge colorScheme="purple" borderRadius="full" px={2}>{totalGames} {totalGames === 1 ? "game" : "games"}</Badge>

          {completed > 0 && <Badge colorScheme="green" borderRadius="full" px={2}>{completed} completed</Badge>}

          {playing > 0 && <Badge colorScheme="purple" variant="outline" borderRadius="full" px={2}>{playing} playing</Badge>}

          {installed > 0 && <Badge colorScheme="gray" borderRadius="full" px={2}>{installed} installed</Badge>}
        </HStack>
        <HStack mt={6} spacing={3}>
          <Button colorScheme="purple" variant="outline" onClick={onEdit}>
            Edit
          </Button>

          <Button colorScheme="red" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        </HStack>
      </Box>
    </Flex>
  );
}
