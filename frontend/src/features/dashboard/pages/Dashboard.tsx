// frontend/src/routes/Dashboard.tsx
import {
  Box,
  Heading,
  Text,
  useColorModeValue,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Badge,
  Button,
  HStack,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { getDashboardStats } from "../api/dashboardApi";
import { useActivity } from "../../activity/hooks/useActivity";
import type { DashboardStats } from "../types/dashboard";

function DashboardPage() {
  const bg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");
  const { activities } = useActivity();
  const [stats, setStats] = useState<DashboardStats>({
    totalGames: 0,
    playing: 0,
    completed: 0,
    dropped: 0,
    plan: 0,
    continuePlaying: [],
    recentGames: [],
    featuredGame: null,
    reviewsWritten: 0,
    averageRating: "0",
    highestRatedGame: null,
  });
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error(error);
      }
    };

    loadStats();
  }, []);

  return (
    <Box minH="100vh" bg={bg}>
      <Box maxW="1200px" mx="auto" px={6} py={8}>
        {/* Page header */}
        <Box mb={6}>
          <Heading size="lg">RoninArc Dashboard</Heading>
          <Text fontSize="sm" color={mutedText} mt={1}>
            Track your gaming library and progress.
          </Text>
        </Box>

        {/* Top row: stats */}
        {/* Stats Grid */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={4} mb={6}>
          {/* Total Games */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Total Games</StatLabel>
              <StatNumber>{stats.totalGames}</StatNumber>
              <StatHelpText>In your library</StatHelpText>
            </Stat>
          </Box>

          {/* Currently Playing */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Currently Playing</StatLabel>
              <StatNumber>{stats.playing}</StatNumber>
              <StatHelpText>Don't drop the streak 👀</StatHelpText>
            </Stat>
          </Box>

          {/* Completed */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Completed</StatLabel>
              <StatNumber>{stats.completed}</StatNumber>
              <StatHelpText>Nice progress!</StatHelpText>
            </Stat>
          </Box>

          {/* Reviews Written */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Reviews Written</StatLabel>
              <StatNumber>{stats.reviewsWritten}</StatNumber>
              <StatHelpText>Total reviews created</StatHelpText>
            </Stat>
          </Box>

          {/* Average Rating */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Average Rating</StatLabel>
              <StatNumber>{stats.averageRating}</StatNumber>
              <StatHelpText>Across all reviews</StatHelpText>
            </Stat>
          </Box>

          {/* Highest Rated */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Highest Rated</StatLabel>

              <StatNumber fontSize="lg" noOfLines={1}>
                {stats.highestRatedGame?.title || "No reviews"}
              </StatNumber>

              <StatHelpText>Your top-rated game</StatHelpText>
            </Stat>
          </Box>
        </SimpleGrid>

        {/* Bottom row: Featured / Continue playing / Recently played */}
        <SimpleGrid columns={{ base: 1, lg: 4 }} spacing={4}>
          {/* Featured game */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Heading size="sm" mb={2}>
              Featured Game
            </Heading>
            <Text fontSize="xs" color={mutedText} mb={3}>
              Hand-picked from your library.
            </Text>

            <VStack align="stretch" spacing={2}>
              <Text fontWeight="semibold" noOfLines={1}>
                {stats.featuredGame?.title || "No Games"}
              </Text>

              <HStack spacing={2} wrap="wrap">
                {stats.featuredGame?.tags?.map((tag: string) => (
                  <Badge key={tag} colorScheme="purple">
                    {tag}
                  </Badge>
                ))}
              </HStack>
              <Button size="sm" mt={2} variant="outline">
                {stats.featuredGame ? "View Game" : "Add Games"}
              </Button>
            </VStack>
          </Box>

          {/* Continue playing */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Heading size="sm" mb={2}>
              Continue Playing
            </Heading>
            <Text fontSize="xs" color={mutedText} mb={3}>
              Games you marked as “Playing”.
            </Text>

            <VStack align="stretch" spacing={2}>
              {stats.continuePlaying.length === 0 ? (
                <Text fontSize="sm" color={mutedText}>
                  No games currently playing
                </Text>
              ) : (
                stats.continuePlaying.map((game) => (
                  <HStack key={game._id} justify="space-between">
                    <Text fontSize="sm" noOfLines={1}>
                      {game.title}
                    </Text>

                    <Badge colorScheme="yellow">{game.status}</Badge>
                  </HStack>
                ))
              )}
            </VStack>
          </Box>

          {/* Recently played */}
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Heading size="sm" mb={2}>
              Recently Added
            </Heading>
            <Text fontSize="xs" color={mutedText} mb={3}>
              Last few games added to your library.
            </Text>

            <VStack align="stretch" spacing={2}>
              {stats.recentGames.length === 0 ? (
                <Text fontSize="sm" color={mutedText}>
                  No recent games
                </Text>
              ) : (
                stats.recentGames.map((game) => (
                  <Text key={game._id} fontSize="sm" noOfLines={1}>
                    {game.title}
                  </Text>
                ))
              )}
            </VStack>
          </Box>
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Heading size="sm" mb={2}>
              Recent Activity
            </Heading>

            <Text fontSize="xs" color={mutedText} mb={3}>
              Your latest actions.
            </Text>

            <VStack align="stretch" spacing={2}>
              {activities.length === 0 ? (
                <Text fontSize="sm" color={mutedText}>
                  No activity yet
                </Text>
              ) : (
                activities.slice(0, 8).map((activity) => (
                  <Text key={activity._id} fontSize="sm" noOfLines={2}>
                    {activity.message}
                  </Text>
                ))
              )}
            </VStack>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
}

export default DashboardPage;
