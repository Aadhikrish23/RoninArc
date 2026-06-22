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
} from "@chakra-ui/react";

import { FiPlay } from "react-icons/fi";

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
  onLaunch,
  isHighlighted
}: GameCardProps) {
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const navigate = useNavigate();

 return (
  <Box
    borderWidth="1px"
    borderRadius="xl"
    overflow="hidden"
    bg={cardBg}
    borderColor={isHighlighted ? "purple.400" : subtleBorder}
    boxShadow={
      isHighlighted
        ? "0 0 20px rgba(159,122,234,.5)"
        : "sm"
    }
    _hover={{
      transform: "translateY(-6px)",
      boxShadow: "2xl",
      borderColor: "purple.400",
    }}
    transition="all .25s ease"
    cursor="pointer"
    onClick={() =>
      navigate(`/library/game/${game.rawgId}`)
    }
  >
    {/* COVER */}
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

      {/* STATUS */}
      <Badge
        position="absolute"
        top={3}
        right={3}
        colorScheme={STATUS_COLOR[game.status]}
        borderRadius="full"
        px={3}
        py={1}
        textTransform="capitalize"
      >
        {game.status}
      </Badge>

      {/* TITLE OVERLAY */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        p={4}
      >
        <Text
          color="white"
          fontWeight="bold"
          fontSize="xl"
          noOfLines={1}
        >
          {game.title}
        </Text>
      </Box>
    </Box>

    {/* CONTENT */}
    <VStack
      align="stretch"
      spacing={3}
      p={4}
    >
      {game.rating && (
        <Badge
          colorScheme="yellow"
          borderRadius="full"
          alignSelf="flex-start"
        >
          ⭐ {game.rating}/10
        </Badge>
      )}

      <HStack
        spacing={2}
        flexWrap="wrap"
      >
        {game.tags.slice(0, 3).map((tag) => (
          <Tag
            key={tag}
            size="sm"
            borderRadius="full"
          >
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

      <Text
        textAlign="center"
        fontSize="sm"
        color="gray.500"
      >
        Click card for details
      </Text>
    </VStack>
  </Box>
);
}
