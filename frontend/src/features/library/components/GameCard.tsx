import {
  Box,
  VStack,
  Flex,
  Text,
  HStack,
  Tag,
  TagLabel,
  Badge,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  useColorModeValue,
} from "@chakra-ui/react";

import { FiEdit3, FiPlay, FiTrash2 } from "react-icons/fi";

import type { Game, Status } from "../types/library";
import type { Collection } from "../../collections/types/collection";
import { useNavigate } from "react-router-dom";

interface GameCardProps {
  game: Game;
  isHighlighted?: boolean;

  collections: Collection[];

  onLaunch: (game: Game) => void;

  onReview: (game: Game) => void;

  onDelete: (id: string) => void;

  onAddToCollection: (collectionId: string, gameId: string) => void;

  onStatusChange: (id: string, status: Status) => void;
}

const STATUS_COLOR = {
  plan: "yellow",
  playing: "purple",
  completed: "green",
  dropped: "red",
};

export default function GameCard({
  game,
  collections,
  onLaunch,
  onReview,
  onDelete,
  onAddToCollection,
  onStatusChange,isHighlighted
}: GameCardProps) {
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const navigate = useNavigate();

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      bg={cardBg}
      
      borderColor={isHighlighted ? "purple.400" : subtleBorder}
      boxShadow={isHighlighted ? "0 0 20px rgba(159,122,234,.5)" : undefined}
      _hover={{
        transform: "translateY(-3px)",
        boxShadow: "lg",
      }}
      transition="all 0.15s ease-out"
      onClick={() => navigate(`/library/game/${game.rawgId}`)}
    >
      <Box
        h="140px"
        borderTopLeftRadius="xl"
        borderTopRightRadius="xl"
        backgroundImage={`url(${game.imageURL})`}
        backgroundSize="cover"
        backgroundPosition="center"
      />

      <VStack align="stretch" spacing={2} p={3}>
        <Flex align="center">
          <Text fontWeight="semibold" noOfLines={1} mr={2}>
            {game.title}
          </Text>
          {game.rating && (
            <Badge colorScheme="yellow" ml={2} borderRadius="full">
              ⭐ {game.rating}/10
            </Badge>
          )}

          <Menu>
            <MenuButton
              as={Badge}
              cursor="pointer"
              colorScheme={STATUS_COLOR[game.status]}
              borderRadius="full"
              textTransform="capitalize"
              px={3}
              py={1}
            >
              {game.status} ▼
            </MenuButton>

            <MenuList>
              <MenuItem onClick={() => onStatusChange(game._id, "plan")}>
                Plan to Play
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

        <HStack spacing={1} wrap="wrap">
          {game.tags.map((tag) => (
            <Tag key={tag} size="sm" variant="subtle" borderRadius="full">
              <TagLabel>{tag}</TagLabel>
            </Tag>
          ))}
        </HStack>

        <Flex justify="space-between" mt={2} gap={2} wrap="wrap">
          <Button
            size="sm"
            leftIcon={<FiPlay />}
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onLaunch(game);
            }}
          >
            Launch
          </Button>

          <Button
            size="sm"
            leftIcon={<FiEdit3 />}
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onReview(game);
            }}
          >
            Review
          </Button>

          <Menu>
            <MenuButton as={Button} size="sm" variant="outline">
              Collection
            </MenuButton>

            <MenuList>
              {collections.length === 0 ? (
                <MenuItem isDisabled>No Collections</MenuItem>
              ) : (
                collections.map((collection) => (
                  <MenuItem
                    key={collection._id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCollection(collection._id, game._id);
                    }}
                  >
                    {collection.name}
                  </MenuItem>
                ))
              )}
            </MenuList>
          </Menu>

          <Button
            size="sm"
            leftIcon={<FiTrash2 />}
            colorScheme="red"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(game._id);
            }}
          >
            Remove
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
}
