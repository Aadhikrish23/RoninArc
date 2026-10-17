import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Skeleton,
  Tag,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { SearchIcon, RepeatIcon } from "@chakra-ui/icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import RecommendationCard from "../components/RecommendationCard";
import { useRecommendations } from "../hooks/useRecommendations";
import type { Recommendation } from "../types/recommendation";

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function Section({
  title,
  subtitle,
  items,
  loading,
  empty,
  actions,
}: {
  title: string;
  subtitle: string;
  items: Recommendation[];
  loading: boolean;
  empty: string;
  actions: Pick<React.ComponentProps<typeof RecommendationCard>, "onAddToLibrary" | "onDismiss" | "onStartPlaying">;
}) {
  const muted = useColorModeValue("gray.600", "gray.400");
  return (
    <Box as="section" aria-label={title}>
      <Heading size="md">{title}</Heading>
      <Text color={muted} fontSize="sm" mb={4}>
        {subtitle}
      </Text>
      {loading ? (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h="320px" borderRadius="xl" />
          ))}
        </SimpleGrid>
      ) : items.length === 0 ? (
        <Box borderWidth="1px" borderStyle="dashed" borderRadius="xl" p={8} textAlign="center">
          <Text color={muted}>{empty}</Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={5}>
          {items.map((rec) => (
            <RecommendationCard key={`${rec.source}-${rec.gameId ?? rec.rawgId}`} rec={rec} {...actions} />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}

export default function RecommendationsPage() {
  const navigate = useNavigate();
  const [hint, setHint] = useState("");
  const q = useDebounced(hint.trim(), 400);
  const { data, loading, error, refresh, dismiss, addToLibrary, startPlaying } = useRecommendations({ limit: 6, q });
  const muted = useColorModeValue("gray.600", "gray.400");
  const actions = { onAddToLibrary: addToLibrary, onDismiss: dismiss, onStartPlaying: startPlaying };

  return (
    <Box maxW="1200px" mx="auto" px={6} py={8}>
      <Flex justify="space-between" align={{ base: "start", md: "end" }} direction={{ base: "column", md: "row" }} gap={4} mb={6}>
        <Box>
          <Heading size="lg">For You</Heading>
          <Text color={muted}>Picks based on what you rate, finish and play.</Text>
        </Box>
        <Button leftIcon={<RepeatIcon />} variant="outline" onClick={refresh} isLoading={loading}>
          Refresh
        </Button>
      </Flex>

      <VStack align="stretch" spacing={4} mb={8}>
        <InputGroup maxW="560px">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            aria-label="What are you in the mood for?"
            placeholder="In the mood for…? Try “like Hades” or “cozy”"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
        </InputGroup>

        {data && (
          <HStack spacing={2} wrap="wrap" aria-label="Your taste">
            {data.focus.length > 0 ? (
              <>
                <Text fontSize="sm" color={muted}>
                  Focusing on:
                </Text>
                {data.focus.map((g) => (
                  <Tag key={g} colorScheme="purple">
                    {g}
                  </Tag>
                ))}
              </>
            ) : data.profile.personalized ? (
              <>
                <Text fontSize="sm" color={muted}>
                  You seem to love:
                </Text>
                {data.profile.topGenres.map((g) => (
                  <Tag key={g.genre}>{g.genre}</Tag>
                ))}
              </>
            ) : (
              <Text fontSize="sm" color={muted}>
                Rate or finish a few games and these picks will get more personal.
              </Text>
            )}
          </HStack>
        )}
      </VStack>

      {error && (
        <Alert status="error" borderRadius="md" mb={6}>
          <AlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <VStack align="stretch" spacing={12}>
        <Section
          title="Play Next"
          subtitle="Games already in your library that you haven't finished."
          items={data?.backlog ?? []}
          loading={loading && !data}
          empty={q ? "None of your backlog games match that. Try the Discover picks below." : "Nothing waiting in your backlog. Add a few games you'd like to play."}
          actions={actions}
        />

        <Box>
          {data?.discoverError && (
            <Alert status="warning" borderRadius="md" mb={4}>
              <AlertIcon />
              <AlertDescription>{data.discoverError}</AlertDescription>
            </Alert>
          )}
          <Section
            title="Discover"
            subtitle="New games you don't own yet."
            items={data?.discover ?? []}
            loading={loading && !data}
            empty="No new games to suggest right now."
            actions={actions}
          />
        </Box>

        {!loading && data && data.backlog.length === 0 && data.discover.length === 0 && (
          <Button alignSelf="center" colorScheme="purple" variant="outline" onClick={() => navigate("/")}>
            Back to your library
          </Button>
        )}
      </VStack>
    </Box>
  );
}
