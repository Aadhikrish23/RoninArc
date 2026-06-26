import {
  Box,
  HStack,
  Image,
  Text,
  VStack,
  Tag,
  TagLabel,
  Button,
  Badge,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiPlay } from "react-icons/fi";
import type { Game, Status } from "../types/library";
import { useNavigate } from "react-router-dom";
import { PROVIDER_CONFIGS } from "../../providers/constants/providers";

interface GameListRowProps {
  game: Game;
  onLaunch: (game: Game) => void;
  onStatusChange: (id: string, status: Status) => void;
}

const STATUS_COLOR = {
  plan: "yellow",
  playing: "purple",
  completed: "green",
  dropped: "red",
};

export default function GameListRow({ game, onLaunch, onStatusChange }: GameListRowProps) {
  const rowBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const navigate = useNavigate();

  const providerConfig = game.provider ? PROVIDER_CONFIGS[game.provider] : null;
  const ProviderIcon = providerConfig?.icon;

  const handleRowClick = () => {
    const detailId = game.rawgId ? String(game.rawgId) : game._id;
    navigate(`/library/game/${detailId}`);
  };

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      bg={rowBg}
      borderColor={subtleBorder}
      p={3}
      _hover={{
        transform: "translateX(4px)",
        borderColor: "purple.400",
        boxShadow: "sm",
      }}
      transition="all 0.2s ease"
      cursor="pointer"
      onClick={handleRowClick}
      w="100%"
    >
      <HStack spacing={4} justify="space-between" align="center" wrap="wrap">
        {/* Left Side: Image and Title Info */}
        <HStack spacing={4} flex={1} minW="250px">
          <Image
            src={game.imageURL}
            fallbackSrc="https://via.placeholder.com/120x80?text=Cover"
            boxSize="50px"
            objectFit="cover"
            borderRadius="md"
            alt={game.title}
          />
          <VStack align="stretch" spacing={1}>
            <HStack spacing={2} wrap="wrap">
              <Text fontWeight="semibold" fontSize="md">
                {game.title}
              </Text>
              {providerConfig && (
                <Badge
                  colorScheme={providerConfig.colorScheme}
                  borderRadius="full"
                  px={2}
                  py={0.5}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <ProviderIcon size={10} />
                  <Text fontSize="10px" fontWeight="bold">
                    {providerConfig.name}
                  </Text>
                </Badge>
              )}
            </HStack>
            <HStack spacing={1} flexWrap="wrap">
              {game.tags.slice(0, 3).map((tag) => (
                <Tag key={tag} size="sm" borderRadius="full">
                  <TagLabel fontSize="xs">{tag}</TagLabel>
                </Tag>
              ))}
            </HStack>
          </VStack>
        </HStack>

        {/* Right Side: Action Controls */}
        <HStack spacing={3} onClick={(e) => e.stopPropagation()}>
          {/* Status Dropdown */}
          <Menu>
            <MenuButton
              as={Button}
              size="sm"
              colorScheme={STATUS_COLOR[game.status]}
              variant="outline"
              borderRadius="full"
              textTransform="capitalize"
              fontSize="xs"
              px={3}
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
          </Menu>

          {/* Launch button */}
          <Button
            colorScheme="purple"
            leftIcon={<FiPlay />}
            size="sm"
            onClick={() => onLaunch(game)}
            fontSize="xs"
            borderRadius="md"
          >
            Launch
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
}
