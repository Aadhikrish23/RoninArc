// frontend/src/features/dashboard/pages/Dashboard.tsx
import {
  Alert,
  AlertDescription,
  AlertIcon,
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Image,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Tooltip,
  useColorModeValue,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiBookmark,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiFolderPlus,
  FiPlay,
  FiPlusCircle,
  FiStar,
  FiTrash2,
} from "react-icons/fi";
import { getDashboardOverview } from "../api/dashboardApi";
import type { DashboardGameSummary, DashboardOverview } from "../types/dashboard";
import { eventBus } from "../../../shared/events/EventBus";
import { canLaunchGames } from "../../../shared/utils/runtime";
import { PLACEHOLDER_IMAGE } from "../../../shared/utils/placeholderImage";

const detailsPath = (g: DashboardGameSummary) => `/library/game/${g.rawgId ? String(g.rawgId) : g._id}`;

/** 0 → "0h", 45 → "45m", 135 → "2h 15m". */
function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Never played";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_ROWS: { key: keyof DashboardOverview["backlog"]["byStatus"]; label: string; color: string }[] = [
  { key: "plan", label: "Plan to Play", color: "yellow" },
  { key: "playing", label: "Playing", color: "purple" },
  { key: "paused", label: "Paused", color: "orange" },
  { key: "completed", label: "Completed", color: "green" },
  { key: "dropped", label: "Dropped", color: "red" },
];

/** Reads after "planned …": "3 days ago", "yesterday", or "on Jun 27, 2026". */
function sincePhrase(iso: string): string {
  const rel = timeAgo(iso);
  return /ago$|^Just now$|^Yesterday$/.test(rel) ? rel.toLowerCase() : `on ${rel}`;
}

const ACTIVITY_ICONS: Record<string, IconType> = {
  GAME_ADDED: FiPlusCircle,
  GAME_REMOVED: FiTrash2,
  STATUS_CHANGED: FiCheckCircle,
  REVIEW_CREATED: FiStar,
  REVIEW_UPDATED: FiStar,
  REVIEW_DELETED: FiStar,
  COLLECTION_CREATED: FiFolderPlus,
  COLLECTION_UPDATED: FiFolderPlus,
  COLLECTION_DELETED: FiFolderPlus,
  GAME_ADDED_TO_COLLECTION: FiFolderPlus,
  GAME_REMOVED_FROM_COLLECTION: FiFolderPlus,
  GAME_LAUNCHED: FiPlay,
  NOTE_CREATED: FiEdit3,
  NOTE_DELETED: FiEdit3,
};

function Panel({ title, icon, action, children }: { title: string; icon: IconType; action?: ReactNode; children: ReactNode }) {
  const cardBg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue("gray.200", "gray.700");
  return (
    <Box as="section" aria-label={title} bg={cardBg} borderWidth="1px" borderColor={border} borderRadius="xl" p={5} shadow="sm">
      <Flex align="center" justify="space-between" mb={4}>
        <HStack spacing={2}>
          <Icon as={icon} color="purple.400" />
          <Heading size="sm">{title}</Heading>
        </HStack>
        {action}
      </Flex>
      {children}
    </Box>
  );
}

function Cover({ game, w, h }: { game: DashboardGameSummary; w: string; h: string }) {
  const placeholder = useColorModeValue("gray.200", "gray.700");
  return game.imageURL ? (
    <Image fallbackSrc={PLACEHOLDER_IMAGE} src={game.imageURL} alt={game.title} w={w} h={h} objectFit="cover" borderRadius="md" flexShrink={0} />
  ) : (
    <Box w={w} h={h} bg={placeholder} borderRadius="md" flexShrink={0} />
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const bg = useColorModeValue("gray.50", "gray.900");
  const mutedText = useColorModeValue("gray.600", "gray.400");
  const rowHover = useColorModeValue("gray.50", "whiteAlpha.100");
  const barBg = useColorModeValue("gray.100", "gray.700");

  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setData(await getDashboardOverview());
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Couldn't load your dashboard. Check that the server is running, then try again.");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => eventBus.subscribe("dashboard.updated", () => loadData()), [loadData]);
  // A game added or changed anywhere (For You, search) changes the backlog numbers too.
  useEffect(() => eventBus.subscribe("library.updated", () => loadData()), [loadData]);

  const desktop = canLaunchGames();
  const maxDaily = data ? Math.max(...data.playtime.daily.map((d) => d.minutes), 1) : 1;
  // Progress is finished games against everything you've committed to, never the whole (mostly unsorted) library.
  const committed = data ? data.backlog.byStatus.completed + data.backlog.size : 0;
  const completedShare = data && committed > 0 ? Math.round((data.backlog.byStatus.completed / committed) * 100) : 0;

  return (
    <Box minH="100vh" bg={bg}>
      <Box maxW="1400px" mx="auto" px={6} py={8}>
        <Box mb={6}>
          <Heading size="lg">Dashboard</Heading>
          <Text fontSize="sm" color={mutedText} mt={1}>
            What you're playing, how much, and what's waiting.
          </Text>
        </Box>

        {error && (
          <Alert status="error" borderRadius="lg" mb={6}>
            <AlertIcon />
            <AlertDescription flex="1">{error}</AlertDescription>
            <Button size="sm" onClick={loadData}>
              Try again
            </Button>
          </Alert>
        )}

        {!data && !error ? (
          <Stack spacing={6} aria-busy="true" aria-label="Loading dashboard">
            <Skeleton h="180px" borderRadius="xl" />
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              <Skeleton h="300px" borderRadius="xl" />
              <Skeleton h="300px" borderRadius="xl" />
            </SimpleGrid>
          </Stack>
        ) : data ? (
          <Stack spacing={6}>
            {/* Pick up where you left off */}
            <Panel
              title="Pick up where you left off"
              icon={FiPlay}
              action={
                <Button size="xs" variant="ghost" colorScheme="purple" onClick={() => navigate("/")}>
                  Library
                </Button>
              }
            >
              {data.continuePlaying.length === 0 ? (
                <Text fontSize="sm" color={mutedText}>
                  Nothing in progress. Set a game to Playing from your library and it will show up here.
                </Text>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                  {data.continuePlaying.map(({ game, lastPlayed, minutesPlayed }) => (
                    <HStack
                      key={game._id}
                      as="article"
                      aria-label={game.title}
                      spacing={3}
                      p={2}
                      borderRadius="lg"
                      cursor="pointer"
                      _hover={{ bg: rowHover }}
                      onClick={() => navigate(detailsPath(game))}
                    >
                      <Cover game={game} w="56px" h="72px" />
                      <Box flex="1" minW={0}>
                        <Text fontWeight="semibold" noOfLines={2} title={game.title}>
                          {game.title}
                        </Text>
                        <Text fontSize="sm" color={mutedText}>
                          {lastPlayed ? `${timeAgo(lastPlayed)} · ${formatMinutes(minutesPlayed)} played` : `${game.progressStatus === "paused" ? "Paused" : "In progress"} · no play sessions recorded yet`}
                        </Text>
                      </Box>
                      <Button size="sm" colorScheme="purple" variant="outline" flexShrink={0}>
                        Open
                      </Button>
                    </HStack>
                  ))}
                </SimpleGrid>
              )}
            </Panel>

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              {/* Playtime */}
              <Panel title="Playtime" icon={FiClock}>
                <SimpleGrid columns={3} spacing={3} mb={5}>
                  {[
                    { label: "Last 7 days", value: formatMinutes(data.playtime.last7DaysMinutes) },
                    { label: "Last 30 days", value: formatMinutes(data.playtime.last30DaysMinutes) },
                    { label: "All time", value: formatMinutes(data.playtime.totalMinutes) },
                  ].map((s) => (
                    <Box key={s.label}>
                      <Text fontSize="2xl" fontWeight="bold" lineHeight={1.2}>
                        {s.value}
                      </Text>
                      <Text fontSize="xs" color={mutedText}>
                        {s.label}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>

                <Box mb={5} aria-label="Playtime per day, last 7 days" role="img">
                  <HStack align="flex-end" spacing={2} h="80px">
                    {data.playtime.daily.map((d) => (
                      <Tooltip key={d.date} label={`${new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "long" })}: ${formatMinutes(d.minutes)}`}>
                        <Box flex="1" h="100%" display="flex" alignItems="flex-end" bg={barBg} borderRadius="sm">
                          <Box w="100%" h={`${Math.max((d.minutes / maxDaily) * 100, d.minutes > 0 ? 6 : 0)}%`} bg="purple.400" borderRadius="sm" />
                        </Box>
                      </Tooltip>
                    ))}
                  </HStack>
                  <HStack spacing={2} mt={1}>
                    {data.playtime.daily.map((d) => (
                      <Text key={d.date} flex="1" textAlign="center" fontSize="xs" color={mutedText}>
                        {new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })}
                      </Text>
                    ))}
                  </HStack>
                </Box>

                <Text fontSize="xs" fontWeight="bold" color={mutedText} textTransform="uppercase" mb={2}>
                  Most played
                </Text>
                {data.playtime.mostPlayed.length === 0 ? (
                  <Text fontSize="sm" color={mutedText}>
                    {desktop
                      ? "No play sessions yet. Launch a game from RoninArc and your hours will be tracked here."
                      : "Playtime is tracked when you launch games from the RoninArc desktop app."}
                  </Text>
                ) : (
                  <VStack align="stretch" spacing={1}>
                    {data.playtime.mostPlayed.map(({ game, minutesPlayed }) => (
                      <HStack key={game._id} spacing={3} p={1.5} borderRadius="md" cursor="pointer" _hover={{ bg: rowHover }} onClick={() => navigate(detailsPath(game))}>
                        <Cover game={game} w="32px" h="40px" />
                        <Text flex="1" fontSize="sm" noOfLines={1}>
                          {game.title}
                        </Text>
                        <Text fontSize="sm" fontWeight="semibold">
                          {formatMinutes(minutesPlayed)}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Panel>

              {/* Backlog progress */}
              <Panel title="Backlog progress" icon={FiBookmark}>
                <Flex justify="space-between" align="baseline" mb={1}>
                  <Text fontSize="sm">
                    <Text as="span" fontSize="2xl" fontWeight="bold">
                      {data.backlog.size}
                    </Text>{" "}
                    {data.backlog.size === 1 ? "game" : "games"} in your backlog
                  </Text>
                  <Text fontSize="sm" color={mutedText}>
                    {data.backlog.completedThisYear} finished this year
                  </Text>
                </Flex>
                <Text fontSize="xs" color={mutedText} mb={2}>
                  {data.backlog.byStatus.completed} of {committed} finished. Dropped games don't count.
                </Text>
                <Progress value={completedShare} colorScheme="green" size="sm" borderRadius="full" mb={4} aria-label="Finished out of planned, playing, paused and completed games" />

                <SimpleGrid columns={{ base: 2, sm: 3 }} spacing={2} mb={data.backlog.unsortedCount > 0 ? 2 : 5}>
                  {STATUS_ROWS.map((s) => (
                    <HStack key={s.key} spacing={2}>
                      <Box w="8px" h="8px" borderRadius="full" bg={`${s.color}.400`} flexShrink={0} />
                      <Text fontSize="sm" flex="1">
                        {s.label}
                      </Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        {data.backlog.byStatus[s.key]}
                      </Text>
                    </HStack>
                  ))}
                </SimpleGrid>
                {data.backlog.unsortedCount > 0 && (
                  <Text fontSize="xs" color={mutedText} mb={5}>
                    {data.backlog.unsortedCount} {data.backlog.unsortedCount === 1 ? "game" : "games"} in your library {data.backlog.unsortedCount === 1 ? "has" : "have"} no status yet and
                    {data.backlog.unsortedCount === 1 ? " isn't" : " aren't"} counted. Set Plan to Play on the ones you mean to play.
                  </Text>
                )}

                <Flex justify="space-between" align="center" mb={2}>
                  <Text fontSize="xs" fontWeight="bold" color={mutedText} textTransform="uppercase">
                    Planned, not started yet{data.backlog.untouchedCount > 0 ? ` (${data.backlog.untouchedCount})` : ""}
                  </Text>
                  {data.backlog.untouchedCount > data.backlog.untouched.length && (
                    <Button size="xs" variant="ghost" colorScheme="purple" onClick={() => navigate("/library/browse?status=plan")}>
                      See all
                    </Button>
                  )}
                </Flex>
                {data.backlog.untouched.length === 0 ? (
                  <Text fontSize="sm" color={mutedText}>
                    {data.backlog.byStatus.plan === 0
                      ? "Nothing planned yet. Mark games as Plan to Play to build your backlog."
                      : "You've started every game you planned. Nice."}
                  </Text>
                ) : (
                  <VStack align="stretch" spacing={1}>
                    {data.backlog.untouched.map(({ game, plannedAt }) => (
                      <HStack key={game._id} spacing={3} p={1.5} borderRadius="md" cursor="pointer" _hover={{ bg: rowHover }} onClick={() => navigate(detailsPath(game))}>
                        <Cover game={game} w="32px" h="40px" />
                        <Text flex="1" fontSize="sm" noOfLines={1}>
                          {game.title}
                        </Text>
                        <Text fontSize="xs" color={mutedText}>
                          planned {sincePhrase(plannedAt)}
                        </Text>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Panel>
            </SimpleGrid>

            {/* Recent activity */}
            <Panel title="Recent activity" icon={FiActivity}>
              {data.recentActivity.length === 0 ? (
                <Text fontSize="sm" color={mutedText}>
                  No activity yet. Adding, rating and finishing games will show up here.
                </Text>
              ) : (
                <VStack as="ol" listStyleType="none" align="stretch" spacing={0}>
                  {data.recentActivity.map((a) => (
                    <HStack
                      as="li"
                      key={a._id}
                      spacing={3}
                      py={2}
                      px={1}
                      borderRadius="md"
                      cursor={a.game ? "pointer" : "default"}
                      _hover={a.game ? { bg: rowHover } : undefined}
                      onClick={() => a.game && navigate(detailsPath(a.game))}
                    >
                      <Icon as={ACTIVITY_ICONS[a.type] ?? FiActivity} color="purple.400" flexShrink={0} />
                      <Text flex="1" fontSize="sm" noOfLines={1}>
                        {a.message}
                      </Text>
                      <Text fontSize="xs" color={mutedText} flexShrink={0}>
                        {timeAgo(a.createdAt)}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              )}
            </Panel>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}

export default DashboardPage;
