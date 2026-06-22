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
  HStack,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { getDashboardStats } from "../api/dashboardApi";
import type { DashboardStats } from "../types/dashboard";
import { usePlaySession } from "../../playSession/hooks/usePlaySession";
import GenreChart from "../components/GenreChart";
import StatusChart from "../components/StatusChart";
function DashboardPage() {
  const bg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");
  const { stats: playtimeStats, loadStats } = usePlaySession();
  const [stats, setStats] = useState<DashboardStats>({
    totalGames: 0,
    playing: 0,
    completed: 0,

    continuePlaying: [],
    recentGames: [],

    genreStats: [],
    statusStats: [],
  });
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getDashboardStats();

        setStats(data);

        await loadStats();
      } catch (error) {
        console.error(error);
      }
    };

    load();
  }, [loadStats]);

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
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={6}>
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

          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Playing</StatLabel>
              <StatNumber>{stats.playing}</StatNumber>
              <StatHelpText>Active adventures</StatHelpText>
            </Stat>
          </Box>

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
              <StatHelpText>Finished journeys</StatHelpText>
            </Stat>
          </Box>

          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Stat>
              <StatLabel>Hours Played</StatLabel>
              <StatNumber>{playtimeStats?.totalHours ?? 0}</StatNumber>

              <StatHelpText>Across all games</StatHelpText>
            </Stat>
          </Box>
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mb={6}>
          <GenreChart data={stats.genreStats} />

          <StatusChart data={stats.statusStats} />
        </SimpleGrid>
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mt={6}>
          <Box
            borderWidth="1px"
            borderRadius="xl"
            borderColor={subtleBorder}
            bg={cardBg}
            p={4}
          >
            <Heading size="sm" mb={4}>
              Continue Playing
            </Heading>

            <VStack align="stretch" spacing={3}>
              {stats.continuePlaying.length === 0 ? (
                <Text color={mutedText}>No active games</Text>
              ) : (
                stats.continuePlaying.map((game) => (
                  <HStack
                    key={game._id}
                    justify="space-between"
                    p={2}
                    borderRadius="md"
                    _hover={{
                      bg: "whiteAlpha.50",
                    }}
                  >
                    <Text>{game.title}</Text>

                    <Badge colorScheme="yellow">PLAYING</Badge>
                  </HStack>
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
            <Heading size="sm" mb={4}>
              Recently Added
            </Heading>

            <VStack align="stretch" spacing={3}>
              {stats.recentGames.map((game) => (
                <Text key={game._id}>{game.title}</Text>
              ))}
            </VStack>
          </Box>
        </SimpleGrid>
      </Box>
    </Box>
  );
}

export default DashboardPage;
