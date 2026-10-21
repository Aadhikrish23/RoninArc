import { canLaunchGames } from "../../../shared/utils/runtime";
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

import { FiPlay, FiPlus, FiTrash2 } from "react-icons/fi";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { useState } from "react";
import RatingText from "../../../shared/components/RatingText";
import CreateCollectionModal from "../../collections/components/CreateCollectionModal";
import { useCollection } from "../../collections/context/CollectionContext";

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
  onLaunch(): void;isRunning?: boolean;
}

const STATUS_COLORS: Record<Status, string> = {
  none: "gray",
  plan: "yellow",
  playing: "purple",
  paused: "orange",
  completed: "green",
  dropped: "red",
};

const STATUS_LABELS: Record<Status, string> = {
  none: "No Status",
  plan: "Plan to Play",
  playing: "Playing",
  paused: "Paused",
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
  onLaunch,isRunning
}: Props) {
  const { createCollection } = useCollection();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const bg = useColorModeValue("white", "gray.800");
  // Your own words should be easy to read, not a faint italic.
  const reviewTextColor = useColorModeValue("gray.700", "gray.200");
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

  const isProviderGame = game.providers && Object.keys(game.providers).length > 0;
  const isInstalled = isProviderGame && Object.values(game.providers || {}).some((p: any) => p.installed === true);

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
        Your library
      </Heading>

      <VStack align="stretch" spacing={5}>
        {/* Status */}
        <Flex justify="space-between" align="center">
          <Text fontWeight="semibold">Status</Text>

          <Menu>
            <MenuButton
              as={Button}
              size="sm"
              colorScheme={STATUS_COLORS[game.progressStatus || "none"]}
              variant="outline"
              borderRadius="full"
              rightIcon={<ChevronDownIcon />}
            >
              {STATUS_LABELS[game.progressStatus || "none"]}
            </MenuButton>

            <MenuList>
              <MenuItem onClick={() => onStatusChange(game._id, "none")}>
                No Status
              </MenuItem>
              <MenuItem onClick={() => onStatusChange(game._id, "plan")}>
                Plan to Play
              </MenuItem>

              <MenuItem onClick={() => onStatusChange(game._id, "playing")}>
                Playing
              </MenuItem>

              <MenuItem onClick={() => onStatusChange(game._id, "paused")}>
                Paused
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
            Your review
          </Heading>

          {review ? (
            <VStack align="stretch" spacing={3}>
              <RatingText fontWeight="bold" fontSize="lg">
                {review.rating}/10
              </RatingText>
              {review.reviewText ? (
                <Text
                  fontSize="sm"
                  color={reviewTextColor}
                  noOfLines={3}
                  whiteSpace="pre-wrap"
                >
                  "{review.reviewText}"
                </Text>
              ) : null}
              <HStack spacing={3}>
                <Button size="sm" colorScheme="purple" variant="outline" onClick={onReview}>
                  Edit review
                </Button>
                <Button size="sm" colorScheme="red" variant="ghost" onClick={onDeleteReview}>
                  Delete review
                </Button>
              </HStack>
            </VStack>
          ) : (
            <VStack align="stretch" spacing={3}>
              <Text fontSize="sm" color="gray.500">
                No review yet.
              </Text>
              <Button size="sm" colorScheme="purple" onClick={onReview} width="fit-content">
                Write review
              </Button>
            </VStack>
          )}
        </Box>

        {/* Playtime */}
        {playtimeHours > 0 || lastPlayed ? (
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
        ) : (
          <Box>
            <Text fontWeight="semibold" fontSize="sm">Playtime</Text>
            <Text fontSize="md" fontWeight="bold">
              Not played yet
            </Text>
          </Box>
        )}

        {/* COLLECTIONS */}
        <Box>
          <Text fontWeight="semibold" mb={3}>
            {assignedCollections.length > 0 ? `Collections (${assignedCollections.length})` : "Collections"}
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
              Add to collection
            </MenuButton>
            <MenuList>
              {collectionsToAddTo.length === 0 ? (
                <MenuItem isDisabled>
                  {collections.length === 0 ? "No collections yet" : "Already in all collections"}
                </MenuItem>
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
              <Divider my={1} />
              <MenuItem icon={<FiPlus />} onClick={() => setIsCreateOpen(true)}>
                New collection…
              </MenuItem>
            </MenuList>
          </Menu>
          <CreateCollectionModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onCreate={async (name, description) => {
              // Made from this game's page: the game goes straight into it.
              const created = await createCollection(name, description);
              if (created?._id) onAddToCollection(created._id, game._id);
            }}
          />
        </Box>

        <Divider my={2} />

        {/* LAUNCH */}
       {canLaunchGames() && (
         <Button
            colorScheme={
              isRunning
                ? "green"
                : isProviderGame && !isInstalled
                  ? "gray"
                  : "purple"
            }
            leftIcon={<FiPlay />}
            isDisabled={isRunning || (isProviderGame && !isInstalled)}
            onClick={(e) => {
              e.stopPropagation();
              onLaunch();
            }}
          >
            {isRunning
              ? "Running"
              : isProviderGame && !isInstalled
                ? "Not Installed"
                : "Launch"}
          </Button>
       )}

        {canLaunchGames() && <Divider my={2} />}

        {/* Removing asks first (confirm dialog), so it can be a quiet button. */}
        <Box pt={2} textAlign="right">
          <Button
            size="sm"
            leftIcon={<FiTrash2 />}
            colorScheme="red"
            variant="ghost"
            onClick={() => onDelete(game._id)}
          >
            Remove from library
          </Button>
        </Box>
      </VStack>
    </Box>
  );
}

