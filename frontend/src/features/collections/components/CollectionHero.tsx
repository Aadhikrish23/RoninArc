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

        <Text color="gray.500" mb={4}>
          {collection.description || "No description"}
        </Text>

        <HStack spacing={3}>
          <Badge colorScheme="purple">{totalGames} Games</Badge>

          <Badge colorScheme="green">{completed} Completed</Badge>

          <Badge colorScheme="blue">{playing} Playing</Badge>

          <Badge colorScheme="orange">{installed} Installed</Badge>
        </HStack>
        <HStack mt={6} spacing={3}>
          <Button colorScheme="purple" variant="outline" onClick={onEdit}>
            Edit
          </Button>

          <Button colorScheme="red" variant="outline" onClick={onDelete}>
            Delete
          </Button>
        </HStack>
      </Box>
    </Flex>
  );
}
