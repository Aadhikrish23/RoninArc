import { canLaunchGames } from "../../../shared/utils/runtime";
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
  useColorModeValue,
  Select,
} from "@chakra-ui/react";
import { FiPlay } from "react-icons/fi";
import type { Game, Status } from "../types/library";
import { useNavigate } from "react-router-dom";
import { PROVIDER_CONFIGS } from "../../providers/constants/providers";
import type { ProviderId } from "../../providers/types/provider";
import { memo } from "react";
import { PLACEHOLDER_IMAGE } from "../../../shared/utils/placeholderImage";
import RatingText from "../../../shared/components/RatingText";

interface GameListRowProps {
  game: Game;
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

function GameListRow({
  game,
  onLaunch,
  onStatusChange,
  isRunning,
}: GameListRowProps) {
  const rowBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const rowHoverBg = useColorModeValue("gray.50", "whiteAlpha.100");
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
        bg: rowHoverBg,
      }}
      transition="all 0.2s ease"
      cursor="pointer"
      onClick={handleRowClick}
      tabIndex={0}
      onKeyDown={(e) => {
        // Enter opens it from the keyboard, like a click; keys inside the card's own controls don't.
        if (e.key === "Enter" && e.target === e.currentTarget) handleRowClick();
      }}
      _focusVisible={{ outline: "2px solid", outlineColor: "purple.400", outlineOffset: "2px" }}
      w="100%"
    >
      <HStack spacing={4} justify="space-between" align="center" wrap="wrap">
        {/* Left Side: Image and Title Info */}
        <HStack spacing={4} flex={1} minW="250px">
          <Image
            src={game.imageURL}
            fallbackSrc={PLACEHOLDER_IMAGE}
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
              {typeof game.rating === "number" && (
                <RatingText fontSize="sm" fontWeight="semibold" aria-label={`Your rating: ${game.rating} out of 10`}>
                  {game.rating}/10
                </RatingText>
              )}

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
          {/* Status: a native select, so the option clicked is the option you get
              (the animated menu could flip upward and land a click on a different status). */}
          <Select
            aria-label={`Status for ${game.title}`}
            size="sm"
            w="auto"
            minW="140px"
            borderRadius="full"
            fontSize="xs"
            borderColor={`${STATUS_COLOR[game.progressStatus || "none"]}.400`}
            value={game.progressStatus || "none"}
            onChange={(e) => onStatusChange(game._id, e.target.value as Status)}
          >
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>

          {/* Launch button */}
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
              size="sm"
              isDisabled={isRunning || (isProviderGame && !isInstalled)}
              onClick={() => onLaunch(game)}
              fontSize="xs"
              borderRadius="md"
            >
              {isRunning
                ? "Running"
                : isProviderGame && !isInstalled
                  ? "Not Installed"
                  : "Launch"}
            </Button>
          )}
        </HStack>
      </HStack>
    </Box>
  );
}
export default memo(GameListRow);
