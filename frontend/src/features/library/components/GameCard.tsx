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

import type { Game, Status } from "../../../types/library";
interface GameCardProps {
  game: Game;

  onLaunch: (game: Game) => void;

  onReview: (game: Game) => void;

  onDelete: (id: string) => void;

  onStatusChange: (
    id: string,
    status: Status
  ) => void;
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
  onReview,
  onDelete,
  onStatusChange,
}: GameCardProps) {
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      bg={cardBg}
      borderColor={subtleBorder}
      _hover={{
        transform: "translateY(-3px)",
        boxShadow: "lg",
      }}
      transition="all 0.15s ease-out"
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
          {game.tags.map((tag: any) => (
            <Tag key={tag} size="sm" variant="subtle" borderRadius="full">
              <TagLabel>{tag}</TagLabel>
            </Tag>
          ))}
        </HStack>

        <Flex justify="space-between" mt={2} gap={2}>
  <Button
    size="sm"
    leftIcon={<FiPlay />}
    variant="outline"
    onClick={() => onLaunch(game)}
  >
    Launch
  </Button>

  <Button
    size="sm"
    leftIcon={<FiEdit3 />}
    variant="outline"
    onClick={() => onReview(game)}
  >
    Review
  </Button>

  <Button
    size="sm"
    leftIcon={<FiTrash2 />}
    colorScheme="red"
    variant="ghost"
    onClick={() => onDelete(game._id)}
  >
    Remove
  </Button>
</Flex>
      </VStack>
    </Box>
  );
}
