import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Badge,
} from "@chakra-ui/react";

import { useNavigate } from "react-router-dom";

import type { Collection } from "../types/collection";
import CollectionCover from "./CollectionCover";

interface Props {
  collection: Collection;

  onDelete: (collectionId: string) => void;

  onRemoveGame: (
    collectionId: string,
    gameId: string
  ) => void;
}

export default function CollectionCard({
  collection,
  onDelete,
}: Props) {
  const navigate = useNavigate();

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      overflow="hidden"
      cursor="pointer"
      transition=".2s"
      _hover={{
        transform: "translateY(-4px)",
        shadow: "lg",
        borderColor: "purple.400",
      }}
      onClick={() =>
        navigate(`/collections/${collection._id}`)
      }
    >
      <CollectionCover games={collection.gameIds} />

      <Box p={4}>
        <Flex
          justify="space-between"
          align="start"
          mb={3}
        >
          <Box>
            <Heading size="sm">
              {collection.name}
            </Heading>

            <Text
              color="gray.500"
              fontSize="sm"
              mt={1}
              noOfLines={2}
            >
              {collection.description ||
                "No description"}
            </Text>
          </Box>

          {/* <Button
            size="xs"
            colorScheme="red"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(collection._id);
            }}
          >
            Delete
          </Button> */}
        </Flex>

        <Badge
          colorScheme="purple"
          borderRadius="full"
          px={2}
        >
          {collection.gameIds.length} Games
        </Badge>
      </Box>
    </Box>
  );
}