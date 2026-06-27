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
  Portal,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiPlay } from "react-icons/fi";
import type { Game, Status } from "../types/library";
import { useNavigate } from "react-router-dom";
import { PROVIDER_CONFIGS } from "../../providers/constants/providers";
import type { ProviderId } from "../../providers/types/provider";
import { memo } from "react";

interface GameListRowProps {
  game: Game;
  onLaunch: (game: Game) => void;
  onStatusChange: (id: string, status: Status) => void;
}

const STATUS_COLOR = {
  none: "gray",
  plan: "yellow",
  playing: "purple",
  paused: "orange",
  completed: "green",
  dropped: "red",
};

const STATUS_LABEL = {
  none: "No Status",
  plan: "Plan to Play",
  playing: "Playing",
  paused: "Paused",
  completed: "Completed",
  dropped: "Dropped",
};

function GameListRow({ game, onLaunch, onStatusChange }: GameListRowProps) {
  const rowBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const navigate = useNavigate();

  const isProviderGame =
    game.providers && Object.keys(game.providers).length > 0;
  const isInstalled =
    isProviderGame &&
    Object.values(game.providers || {}).some((p) => p.installed === true);

  const handleRowClick = () => {
    const detailId = game.rawgId ? String(game.rawgId) : game._id;
    navigate(`/library/game/${detailId}`);
  };

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      overflow="visible"
      bg={rowBg}
      borderColor={subtleBorder}
      p={3}
      _hover={{
        borderColor: "purple.400",
        boxShadow: "md",
        bg: "gray.750",
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

              {isProviderGame && (
                <Badge colorScheme="blue" borderRadius="full" px={2} py={0.5}>
                  Owned
                </Badge>
              )}

              {isProviderGame && (
                <Badge
                  colorScheme={isInstalled ? "green" : "gray"}
                  borderRadius="full"
                  px={2}
                  py={0.5}
                >
                  {isInstalled ? "Installed" : "Not Installed"}
                </Badge>
              )}

              {Object.keys(game.providers || {}).map((providerKey) => {
                const config = PROVIDER_CONFIGS[providerKey as ProviderId];
                if (!config) return null;
                const Icon = config.icon;
                return (
                  <Badge
                    key={providerKey}
                    colorScheme={config.colorScheme}
                    borderRadius="full"
                    px={2}
                    py={0.5}
                    display="flex"
                    alignItems="center"
                    gap={1}
                  >
                    <Icon size={10} />
                    <Text fontSize="10px" fontWeight="bold">
                      {config.name}
                    </Text>
                  </Badge>
                );
              })}
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
              colorScheme={STATUS_COLOR[game.progressStatus || "none"]}
              variant="outline"
              borderRadius="full"
              textTransform="capitalize"
              fontSize="xs"
              px={3}
            >
              {STATUS_LABEL[game.progressStatus || "none"]}
            </MenuButton>

            <Portal>
              <MenuList>
                <MenuItem onClick={() => onStatusChange(game._id, "none")}>
                  ⚪ No Status
                </MenuItem>

                <MenuItem onClick={() => onStatusChange(game._id, "plan")}>
                  🟡 Plan To Play
                </MenuItem>

                <MenuItem onClick={() => onStatusChange(game._id, "playing")}>
                  🟣 Playing
                </MenuItem>

                <MenuItem onClick={() => onStatusChange(game._id, "paused")}>
                  🟠 Paused
                </MenuItem>

                <MenuItem onClick={() => onStatusChange(game._id, "completed")}>
                  🟢 Completed
                </MenuItem>

                <MenuItem onClick={() => onStatusChange(game._id, "dropped")}>
                  🔴 Dropped
                </MenuItem>
              </MenuList>
            </Portal>
          </Menu>

          {/* Launch button */}
          <Button
            colorScheme={isProviderGame && !isInstalled ? "gray" : "purple"}
            leftIcon={<FiPlay />}
            size="sm"
            isDisabled={isProviderGame && !isInstalled}
            onClick={() => onLaunch(game)}
            fontSize="xs"
            borderRadius="md"
          >
            {isProviderGame && !isInstalled ? "Not Installed" : "Launch"}
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
}
export default memo(GameListRow);
