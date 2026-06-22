import {
  Box,
  Heading,
  Text,
  SimpleGrid,
} from "@chakra-ui/react";

import CollectionCard from "../../collections/components/CollectionCard";

import type { Collection } from "../../collections/types/collection";

interface Props {
  collections: Collection[];

  onDelete: (collectionId: string) => void;

  onRemoveGame: (
    collectionId: string,
    gameId: string
  ) => void;
}

export default function CollectionsSection({
  collections,
  onDelete,
  onRemoveGame,
}: Props) {
  return (
   <Box mb={10}>
  <Heading size="md" mb={4}>
    Collections
  </Heading>

  {collections.length === 0 ? (
    <Text color="gray.500">
      No collections created yet.
    </Text>
  ) : (
    <SimpleGrid
      columns={{
        base: 1,
        md: 2,
        lg: 4,
      }}
      spacing={4}
    >
      {collections.map((collection) => (
        <CollectionCard
          key={collection._id}
          collection={collection}
          onDelete={onDelete}
          onRemoveGame={onRemoveGame}
        />
      ))}
    </SimpleGrid>
  )}
</Box>
  );
}