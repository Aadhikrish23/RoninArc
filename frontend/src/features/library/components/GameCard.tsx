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
  Image,
  Skeleton,
} from "@chakra-ui/react";

import { FiPlay } from "react-icons/fi";
import type { Game, Status } from "../types/library";
import { useNavigate } from "react-router-dom";
import { PROVIDER_CONFIGS } from "../../providers/constants/providers";
import type { ProviderId } from "../../providers/types/provider";
import { memo, useState } from "react";

interface GameCardProps {
  game: Game;
  isHighlighted?: boolean;

  onLaunch: (game: Game) => void;

  onStatusChange: (id: string, status: Status) => void;
  isRunning?: boolean;
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

function GameCard({
  game,
  onLaunch,
  isHighlighted,
  onStatusChange,
  isRunning,
}: GameCardProps) {
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const navigate = useNavigate();

  const isProviderGame =
    game.providers && Object.keys(game.providers).length > 0;
  const isInstalled =
    isProviderGame &&
    Object.values(game.providers || {}).some((p) => p.installed === true);

  const handleCardClick = () => {
    const detailId = game.rawgId ? String(game.rawgId) : game._id;
    navigate(`/library/game/${detailId}`);
  };
  const [loaded, setLoaded] = useState(false);

  return (
    <Box
      borderWidth="1px"
      borderRadius="xl"
      overflow="hidden"
      bg={cardBg}
      borderColor={isHighlighted ? "purple.400" : subtleBorder}
      boxShadow={isHighlighted ? "0 0 20px rgba(159,122,234,.5)" : "sm"}
      transition="all .25s ease"
      cursor="pointer"
      _hover={{
        transform: "translateY(-4px)",
        borderColor: "purple.400",
        boxShadow: "xl",
      }}
      onClick={handleCardClick}
    >
      {/* COVER */}
      <Box position="relative">
        <Image
          src={game.imageURL}
          alt={game.title}
          h="240px"
          w="100%"
          objectFit="cover"
          loading="lazy"
          decoding="async"
          fallbackSrc="/placeholder.jpg"
          opacity={loaded ? 1 : 0}
          transition="opacity .3s"
          onLoad={() => setLoaded(true)}
        />

        <Box
          position="absolute"
          inset={0}
          bgGradient="linear(to-t, blackAlpha.900, transparent)"
        />

        {/* Provider Badge */}
        {Object.keys(game.providers || {}).map((providerKey) => {
          const config = PROVIDER_CONFIGS[providerKey as ProviderId];
          if (!config) return null;

          const Icon = config.icon;

          return (
            <Badge
              key={providerKey}
              position="absolute"
              top={3}
              left={3}
              borderRadius="full"
              px={3}
              py={1}
              display="flex"
              alignItems="center"
              gap={1.5}
              zIndex={2}
              bg="blackAlpha.700"
              backdropFilter="blur(8px)"
              color="white"
              border="1px solid"
              borderColor={`${config.colorScheme}.300`}
            >
              <Icon size={12} color="currentColor" />

              <Text fontSize="10px" fontWeight="700" letterSpacing="0.4px">
                {config.name.toUpperCase()}
              </Text>
            </Badge>
          );
        })}

        {/* Status */}
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
              borderRadius="full"
              backdropFilter="blur(12px)"
              color="white"
              border="1px solid"
              borderColor={`${STATUS_COLOR[game.progressStatus || "none"]}.300`}
              _hover={{
                bg: "blackAlpha.800",
              }}
            >
              {STATUS_LABEL[game.progressStatus || "none"]}
            </MenuButton>

            <MenuList>
              <MenuItem onClick={() => onStatusChange(game._id, "none")}>
                No Status
              </MenuItem>

              <MenuItem onClick={() => onStatusChange(game._id, "plan")}>
                Plan
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
          </Box>
        </Menu>
      </Box>

      {/* Bottom */}
      <VStack align="stretch" spacing={4} p={4}>
        <Text fontWeight="bold" fontSize="lg" noOfLines={2} minH="52px">
          {game.title}
        </Text>

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
            onLaunch(game);
          }}
        >
          {isRunning
            ? "Running"
            : isProviderGame && !isInstalled
              ? "Not Installed"
              : "Launch"}
        </Button>
      </VStack>
    </Box>
  );
}

export default memo(GameCard);
