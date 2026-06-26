import { HStack, Box, Text } from "@chakra-ui/react";
import CollectionCard from "../../collections/components/CollectionCard";
import type { Collection } from "../../collections/types/collection";

interface CollectionCarouselProps {
  collections: Collection[];
  onDelete: (collectionId: string) => void;
  onRemoveGame: (collectionId: string, gameId: string) => void;
  emptyMessage?: string;
}

export default function CollectionCarousel({
  collections,
  onDelete,
  onRemoveGame,
  emptyMessage = "No collections created yet.",
}: CollectionCarouselProps) {
  if (collections.length === 0) {
    return (
      <Text color="gray.500" py={4}>
        {emptyMessage}
      </Text>
    );
  }

  return (
    <HStack spacing={6} align="stretch" pb={4}>
      {collections.map((collection) => (
        <Box key={collection._id} minW="320px" maxW="320px">
          <CollectionCard
            collection={collection}
            onDelete={onDelete}
            onRemoveGame={onRemoveGame}
          />
        </Box>
      ))}
    </HStack>
  );
}
