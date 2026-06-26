import {
  Box,
  VStack,
  Text,
  HStack,
  Tag,
  TagLabel,
  Badge,
  Button,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react";

import { FiPlay } from "react-icons/fi";
import type { Game, Status } from "../types/library";
import type { Collection } from "../../collections/types/collection";
import { useNavigate } from "react-router-dom";
import { PROVIDER_CONFIGS } from "../../providers/constants/providers";

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
  onLaunch,
  isHighlighted,
  onStatusChange,
}: GameCardProps) {
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const navigate = useNavigate();

  const providerConfig = game.provider ? PROVIDER_CONFIGS[game.provider] : null;
  const ProviderIcon = providerConfig?.icon;

  const handleCardClick = () => {
    const detailId = game.rawgId ? String(game.rawgId) : game._id;
    navigate(`/library/game/${detailId}`);
  };

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      overflow="hidden"
      bg={cardBg}
      borderColor={isHighlighted ? "purple.400" : subtleBorder}
      boxShadow={isHighlighted ? "0 0 20px rgba(159,122,234,.5)" : "sm"}
      _hover={{
        transform: "translateY(-6px)",
        boxShadow: "2xl",
        borderColor: "purple.400",
      }}
      transition="all .25s ease"
      cursor="pointer"
      onClick={handleCardClick}
    >
      {/* COVER CONTAINER */}
      <Box position="relative">
        <Box
          h="220px"
          backgroundImage={`url(${game.imageURL})`}
          backgroundSize="cover"
          backgroundPosition="center"
        />
        <Box
          position="absolute"
          inset={0}
          bgGradient="linear(to-t, blackAlpha.900, transparent)"
        />

        {/* TOP LEFT BADGES */}
        <HStack position="absolute" top={3} left={3} spacing={2} zIndex={2}>
          {game.rating && (
            <Badge
              colorScheme="yellow"
              borderRadius="full"
              px={3}
              py={1}
            >
              ⭐ {game.rating}/10
            </Badge>
          )}
          {providerConfig && (
            <Badge
              colorScheme={providerConfig.colorScheme}
              borderRadius="full"
              px={3}
              py={1}
              display="flex"
              alignItems="center"
              gap={1}
            >
              <ProviderIcon size={12} />
              <Text fontSize="xs" fontWeight="bold">
                {providerConfig.name}
              </Text>
            </Badge>
          )}
        </HStack>

        {/* STATUS BADGE (TOP RIGHT) */}
        <Menu>
          <Box
            position="absolute"
            top={3}
            right={3}
            zIndex={2}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuButton
              as={Button}
              size="xs"
              colorScheme={STATUS_COLOR[game.status]}
              borderRadius="full"
              textTransform="capitalize"
            >
              {game.status}
            </MenuButton>

            <MenuList>
              <MenuItem onClick={() => onStatusChange(game._id, "plan")}>
                🟡 Plan To Play
              </MenuItem>

              <MenuItem onClick={() => onStatusChange(game._id, "playing")}>
                🟣 Playing
              </MenuItem>

              <MenuItem onClick={() => onStatusChange(game._id, "completed")}>
                🟢 Completed
              </MenuItem>

              <MenuItem onClick={() => onStatusChange(game._id, "dropped")}>
                🔴 Dropped
              </MenuItem>
            </MenuList>
          </Box>
        </Menu>

        {/* TITLE OVERLAY */}
        <Box position="absolute" bottom={0} left={0} right={0} p={4}>
          <Text color="white" fontWeight="bold" fontSize="xl" noOfLines={1}>
            {game.title}
          </Text>
        </Box>
      </Box>

      {/* CONTENT BELOW IMAGE */}
      <VStack align="stretch" spacing={3} p={4}>
        <HStack spacing={2} flexWrap="wrap">
          {game.tags.slice(0, 3).map((tag) => (
            <Tag key={tag} size="sm" borderRadius="full">
              <TagLabel>{tag}</TagLabel>
            </Tag>
          ))}
        </HStack>

        <Button
          colorScheme="purple"
          leftIcon={<FiPlay />}
          size="md"
          onClick={(e) => {
            e.stopPropagation();
            onLaunch(game);
          }}
        >
          Launch Game
        </Button>

        <Text textAlign="center" fontSize="sm" color="gray.500">
          Click card for details
        </Text>
      </VStack>
    </Box>
  );
}
