import {
  Box,
  Flex,
  Heading,
  Text,
  Badge,
  Button,
  VStack,
} from "@chakra-ui/react";

import type { Collection } from "../types/collection";

interface Props {
  collection: Collection;

  onDelete: (collectionId: string) => void;

  onRemoveGame: (collectionId: string, gameId: string) => void;
}

export default function CollectionCard({ collection, onDelete,onRemoveGame }: Props) {
    

  return (
    <Box borderWidth="1px" borderRadius="xl" p={4}>
      <Flex justify="space-between" align="center" mb={3}>
        <Heading size="sm">{collection.name}</Heading>

        <Button
          size="xs"
          colorScheme="red"
          variant="ghost"
          onClick={() => onDelete(collection._id)}
        >
          Delete
        </Button>
      </Flex>

      <Text fontSize="sm" color="gray.500" mb={3}>
        {collection.description || "No description"}
      </Text>

      <VStack align="stretch" spacing={2}>
        <Badge colorScheme="purple" width="fit-content">
          {collection.gameIds.length} Games
        </Badge>

        {collection.gameIds.map((game) => (
          <Flex key={game._id} justify="space-between" align="center">
            <Text fontSize="sm" noOfLines={1}>
              {game.title}
            </Text>

            <Button
              size="xs"
              colorScheme="red"
              variant="ghost"
              onClick={() => onRemoveGame(collection._id, game._id)}
            >
              Remove
            </Button>
          </Flex>
        ))}
      </VStack>
    </Box>
  );
}
