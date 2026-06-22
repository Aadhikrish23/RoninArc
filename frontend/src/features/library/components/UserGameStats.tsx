import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Text,
  VStack,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tag,
  TagLabel,
  TagCloseButton,
  Wrap,
  Divider,
} from "@chakra-ui/react";

import { FiPlay, FiTrash2 } from "react-icons/fi";

import type { Status, Game } from "../types/library";
import type { Collection } from "../../collections/types/collection";
import type { Review } from "../../reviews/types/review";

interface Props {
  game: Game | null;
  onReview(): void;
  onDeleteReview(): void;
  review: Review | null;
  playtimeHours: number;
  lastPlayed: string | null;
  onDelete(id: string): void;
  onStatusChange(id: string, status: Status): void;
  collections: Collection[];
  onAddToCollection(collectionId: string, gameId: string): void;
  onRemoveFromCollection(collectionId: string, gameId: string): void;
  onLaunch(): void;
}

const STATUS_COLORS: Record<Status, string> = {
  plan: "yellow",
  playing: "purple",
  completed: "green",
  dropped: "red",
};

const STATUS_LABELS: Record<Status, string> = {
  plan: "Plan to Play",
  playing: "Playing",
  completed: "Completed",
  dropped: "Dropped",
};

function formatLastPlayed(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  const now = new Date();
  
  const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = dNow.getTime() - dDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UserGameStats({
  game,
  onReview,
  onDeleteReview,
  review,
  playtimeHours,
  lastPlayed,
  onDelete,
  onStatusChange,
  collections,
  onAddToCollection,
  onRemoveFromCollection,
  onLaunch,
}: Props) {
  const bg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  if (!game) {
    return (
      <Box
        mt={8}
        p={6}
        borderWidth="1px"
        borderRadius="xl"
        bg={bg}
        borderColor={borderColor}
      >
        <Heading size="md" mb={2}>
          Not In Library
        </Heading>

        <Text color="gray.500">
          Add this game to track progress, reviews and collections.
        </Text>
      </Box>
    );
  }

  const assignedCollections = collections.filter((c) =>
    c.gameIds.some((g) => g._id === game._id)
  );

  const collectionsToAddTo = collections.filter(
    (c) => !c.gameIds.some((g) => g._id === game._id)
  );

  return (
    <Box
      mt={8}
      p={6}
      borderWidth="1px"
      borderRadius="xl"
      bg={bg}
      borderColor={borderColor}
    >
      <Heading size="md" mb={5}>
        Your Library
      </Heading>

      <VStack align="stretch" spacing={5}>
        {/* Status */}
        <Flex justify="space-between" align="center">
          <Text fontWeight="semibold">Status</Text>

          <Menu>
            <MenuButton
              as={Button}
              size="sm"
              colorScheme={STATUS_COLORS[game.status]}
              textTransform="capitalize"
              borderRadius="full"
              rightIcon={<span>▼</span>}
            >
              {STATUS_LABELS[game.status]}
            </MenuButton>

            <MenuList>
              <MenuItem onClick={() => onStatusChange(game._id, "plan")}>
                Plan To Play
              </MenuItem>

              <MenuItem onClick={() => onStatusChange(game._id, "playing")}>
                Playing
              </MenuItem>

              <MenuItem onClick={() => onStatusChange(game._id, "completed")}>
                Completed
              </MenuItem>

              <MenuItem onClick={() => onStatusChange(game._id, "dropped")}>
                Dropped
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>

        {/* REVIEW */}
        <Box p={4} borderWidth="1px" borderRadius="lg" bg={useColorModeValue("gray.50", "gray.900")}>
          <Heading size="sm" mb={3}>
            Your Review
          </Heading>

          {review ? (
            <VStack align="stretch" spacing={3}>
              <Text fontWeight="bold" fontSize="lg">
                ⭐ {review.rating}/10
              </Text>
              {review.reviewText ? (
                <Text
                  fontSize="sm"
                  color="gray.500"
                  noOfLines={3}
                  whiteSpace="pre-wrap"
                  fontStyle="italic"
                >
                  "{review.reviewText}"
                </Text>
              ) : (
                <Text fontSize="sm" color="gray.400" fontStyle="italic">
                  No review text
                </Text>
              )}
              <HStack spacing={3}>
                <Button size="xs" colorScheme="purple" variant="outline" onClick={onReview}>
                  Edit Review
                </Button>
                <Button size="xs" colorScheme="red" variant="outline" onClick={onDeleteReview}>
                  Delete Review
                </Button>
              </HStack>
            </VStack>
          ) : (
            <VStack align="stretch" spacing={3}>
              <Text fontSize="sm" color="gray.500">
                No review yet.
              </Text>
              <Button size="xs" colorScheme="purple" onClick={onReview} width="fit-content">
                Write Review
              </Button>
            </VStack>
          )}
        </Box>

        {/* Playtime */}
        <HStack justify="space-between" spacing={4}>
          <Box>
            <Text fontWeight="semibold" fontSize="sm">Playtime</Text>
            <Text fontSize="md" fontWeight="bold">
              {playtimeHours.toFixed(1)} hours
            </Text>
          </Box>
          <Box textAlign="right">
            <Text fontWeight="semibold" fontSize="sm">Last Played</Text>
            <Text fontSize="md" fontWeight="bold">
              {formatLastPlayed(lastPlayed)}
            </Text>
          </Box>
        </HStack>

        {/* COLLECTIONS */}
        <Box>
          <Text fontWeight="semibold" mb={3}>
            Collections ({assignedCollections.length})
          </Text>

          <Wrap mb={3}>
            {assignedCollections.map((collection) => (
              <Tag
                key={collection._id}
                size="md"
                colorScheme="purple"
                borderRadius="full"
                py={1}
                px={3}
              >
                <TagLabel>{collection.name}</TagLabel>
                <TagCloseButton
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromCollection(collection._id, game._id);
                  }}
                />
              </Tag>
            ))}
          </Wrap>

          <Menu>
            <MenuButton
              as={Button}
              size="sm"
              variant="outline"
              colorScheme="purple"
              width="fit-content"
            >
              Add To Collection
            </MenuButton>
            <MenuList>
              {collectionsToAddTo.length === 0 ? (
                <MenuItem isDisabled>Already in all collections</MenuItem>
              ) : (
                collectionsToAddTo.map((collection) => (
                  <MenuItem
                    key={collection._id}
                    onClick={() => onAddToCollection(collection._id, game._id)}
                  >
                    {collection.name}
                  </MenuItem>
                ))
              )}
            </MenuList>
          </Menu>
        </Box>

        <Divider my={2} />

        {/* LAUNCH */}
        <Button
          w="100%"
          colorScheme="green"
          size="lg"
          leftIcon={<FiPlay />}
          onClick={onLaunch}
        >
          Launch Game
        </Button>

        <Divider my={2} />

        {/* DANGER ZONE */}
        <Box pt={2}>
          <Text
            fontSize="xs"
            fontWeight="bold"
            color="red.500"
            textTransform="uppercase"
            mb={3}
          >
            Danger Zone
          </Text>
          <Button
            w="100%"
            leftIcon={<FiTrash2 />}
            colorScheme="red"
            variant="outline"
            onClick={() => onDelete(game._id)}
          >
            Remove From Library
          </Button>
        </Box>
      </VStack>
    </Box>
  );
}

