import { Box, Button, Flex, Heading, SimpleGrid, Text, useColorModeValue } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import RecommendationCard from "./RecommendationCard";
import { useRecommendations } from "../hooks/useRecommendations";

/** Compact "Recommended for you" row for the library home page. */
export default function RecommendedStrip() {
  const navigate = useNavigate();
  const muted = useColorModeValue("gray.600", "gray.400");
  const { data, dismiss, addToLibrary, startPlaying } = useRecommendations({ limit: 4 });

  // New games only: your own games are already in the sections above (and on For You's "Play Next").
  const picks = data ? data.discover.slice(0, 4) : [];
  if (picks.length === 0) return null;

  return (
    <Box as="section" aria-label="Recommended For You">
      <Flex justify="space-between" align="center" mb={1}>
        <Heading size="md">Recommended For You</Heading>
        <Button size="sm" variant="ghost" colorScheme="purple" onClick={() => navigate("/recommendations")}>
          See all
        </Button>
      </Flex>
      <Text fontSize="sm" color={muted} mb={4}>
        {data?.profile.personalized ? "New games picked from what you rate, finish and play." : "Popular games to get you started. Rate or finish a few and these get personal."}
      </Text>
      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={5}>
        {picks.map((rec) => (
          <RecommendationCard
            key={`${rec.source}-${rec.gameId ?? rec.rawgId}`}
            rec={rec}
            onAddToLibrary={addToLibrary}
            onDismiss={dismiss}
            onStartPlaying={startPlaying}
          />
        ))}
      </SimpleGrid>
    </Box>
  );
}
