import {
  Badge,
  Box,
  Button,
  HStack,
  Image,
  Stack,
  Text,
  Tooltip,
  Wrap,
  WrapItem,
  useColorModeValue,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import type { Recommendation } from "../types/recommendation";
import { PLACEHOLDER_IMAGE } from "../../../shared/utils/placeholderImage";

interface Props {
  rec: Recommendation;
  onAddToLibrary: (rec: Recommendation) => void;
  onDismiss: (rec: Recommendation) => void;
  onStartPlaying: (rec: Recommendation) => void;
  /** "82% match" only means something once picks are personal, and never on a game you own. */
  showScore?: boolean;
}

export default function RecommendationCard({ rec, onAddToLibrary, onDismiss, onStartPlaying, showScore = true }: Props) {
  const navigate = useNavigate();
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.700");
  const muted = useColorModeValue("gray.600", "gray.400");
  const fromLibrary = rec.source === "library";

  const openDetails = () => {
    if (rec.rawgId) navigate(`/library/game/${rec.rawgId}`);
  };

  return (
    <Box
      as="article"
      aria-label={rec.title}
      bg={cardBg}
      borderWidth="1px"
      borderColor={border}
      borderRadius="xl"
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      <Box
        position="relative"
        cursor={rec.rawgId ? "pointer" : "default"}
        onClick={openDetails}
        tabIndex={rec.rawgId ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter") openDetails();
        }}
        _focusVisible={{ outline: "2px solid", outlineColor: "purple.400", outlineOffset: "2px" }}
      >
        <Image src={rec.imageURL} alt={rec.title} h="160px" w="100%" objectFit="cover" fallbackSrc={PLACEHOLDER_IMAGE} />
        {showScore && !fromLibrary && (
          <Tooltip label="How well this fits your taste" hasArrow>
            <Badge position="absolute" top={3} right={3} colorScheme="purple" variant="solid" fontSize="0.8em" px={2} py={1} borderRadius="full" boxShadow="md">
              {rec.score}% match
            </Badge>
          </Tooltip>
        )}
        {fromLibrary && (
          <Badge position="absolute" top={3} left={3} colorScheme="green" variant="solid" fontSize="0.7em" px={2} py={1} borderRadius="full" boxShadow="md">
            In your library
          </Badge>
        )}
      </Box>

      <Stack spacing={3} p={4} flex="1">
        <Box>
          <Text fontWeight="bold" fontSize="md" noOfLines={1} cursor={rec.rawgId ? "pointer" : "default"} onClick={openDetails}>
            {rec.title}
          </Text>
          <Wrap spacing={1} mt={1}>
            {rec.genres.slice(0, 3).map((g) => (
              <WrapItem key={g}>
                <Badge variant="subtle" fontSize="0.65em">
                  {g}
                </Badge>
              </WrapItem>
            ))}
          </Wrap>
        </Box>

        <Stack spacing={1} flex="1" aria-label="Why we picked it">
          {rec.reasons.slice(0, 2).map((reason) => (
            <Text key={reason} fontSize="sm" color={muted}>
              {reason}
            </Text>
          ))}
        </Stack>

        <HStack spacing={2} flexWrap="wrap">
          {fromLibrary && rec.status === "playing" ? (
            <Button size="sm" colorScheme="purple" variant="outline" flex="1" onClick={openDetails}>
              View game
            </Button>
          ) : fromLibrary ? (
            <Button size="sm" colorScheme="purple" flex="1" onClick={() => onStartPlaying(rec)}>
              Start playing
            </Button>
          ) : (
            <>
              <Button size="sm" colorScheme="purple" flex="1" minW="fit-content" onClick={() => onAddToLibrary(rec)}>
                Add to Library
              </Button>
              <Button size="sm" variant="ghost" flexShrink={0} onClick={() => onDismiss(rec)}>
                Not interested
              </Button>
            </>
          )}
        </HStack>
      </Stack>
    </Box>
  );
}
