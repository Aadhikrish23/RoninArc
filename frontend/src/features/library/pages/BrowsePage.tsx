import {
  Box,
  Heading,
  Flex,
  Select,
  Input,
  IconButton,
  ButtonGroup,
  SimpleGrid,
  VStack,
  HStack,
  Spinner,
  Text,
  useColorModeValue,
  Button,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FiGrid, FiList } from "react-icons/fi";
import { ArrowBackIcon } from "@chakra-ui/icons";

import GameCard from "../components/GameCard";
import GameListRow from "../components/GameListRow";
import ReviewModal from "../../reviews/components/ReviewModal";
import CreateCollectionModal from "../../collections/components/CreateCollectionModal";

import { useLibrary } from "../hooks/useLibrary";
import { useReview } from "../../reviews/hooks/useReview";
import { useCollection } from "../../collections/hooks/useCollections";
import { useLaunchGame } from "../hooks/useLaunchGame";
import { matchesTitle } from "../utils/titleSearch";

const readPref = (key: string) => {
  try {
    return localStorage.getItem(`roninarc.${key}`);
  } catch {
    return null;
  }
};
const writePref = (key: string, value: string) => {
  try {
    localStorage.setItem(`roninarc.${key}`, value);
  } catch {
    // storage unavailable (private window): just don't remember
  }
};

export default function BrowsePage() {
  const {
    games,
    loading,
    error,
    fetchLibrary,
    updateStatus,
    refreshGame,
  } = useLibrary();
  const {
    fetchCollections,
    createCollection,
  } = useCollection();

  // View and sort are remembered between visits (per browser).
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => (readPref("browse.view") === "list" ? "list" : "grid"));

  // Filters State
  const [searchText, setSearchText] = useState("");
  // The Dashboard links here with ?status=plan etc.
  const [searchParams] = useSearchParams();
  const [selectedProgress, setSelectedProgress] = useState(searchParams.get("status") || "all");
  const [selectedOwnership, setSelectedOwnership] = useState("all");
  const [selectedInstallation, setSelectedInstallation] = useState("all");
  const [sortBy, setSortBy] = useState(() => readPref("browse.sort") || "title-asc");
  useEffect(() => writePref("browse.view", viewMode), [viewMode]);
  useEffect(() => writePref("browse.sort", sortBy), [sortBy]);
  const [visibleCount, setVisibleCount] = useState(24);

  // Modals State
  const { openLaunchModal, runningGames } = useLaunchGame();
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);

  const navigate = useNavigate();
  const bg = useColorModeValue("gray.50", "gray.900");

  const updateGameRating = (gameId: string) => {
    refreshGame(gameId);
  };

  const {
    reviewGame,
    currentReview,
    closeReviewModal,
    saveReview,
    deleteReview: deleteReviewHandler,
  } = useReview(updateGameRating);

  useEffect(() => {
    fetchLibrary();
    fetchCollections();
  }, [fetchLibrary, fetchCollections]);

  // Filtered & Sorted Games list
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      // 1. Progress Status
      const matchProgress =
        selectedProgress === "all" || game.progressStatus === selectedProgress;

      // 2. Search Text
      const matchSearch = matchesTitle(game.title, searchText);

      // 3. Ownership
      const isOwned = game.providers && Object.keys(game.providers).length > 0;
      const matchOwnership =
        selectedOwnership === "all" ||
        (selectedOwnership === "owned" && isOwned) ||
        (selectedOwnership === "manual" && !isOwned);

      // 4. Installation
      const isInstalled =
        isOwned &&
        Object.values(game.providers || {}).some(
          (p: any) => p.installed === true,
        );
      const matchInstallation =
        selectedInstallation === "all" ||
        (selectedInstallation === "installed" && isInstalled) ||
        (selectedInstallation === "uninstalled" && !isInstalled);

      return (
        matchProgress && matchSearch && matchOwnership && matchInstallation
      );
    });
  }, [
    games,
    selectedProgress,
    searchText,
    selectedOwnership,
    selectedInstallation,
  ]);

  const sortedGames = useMemo(() => {
    const result = [...filteredGames];
    if (sortBy === "title-asc") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "title-desc") {
      result.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === "date-desc") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sortBy === "date-asc") {
      result.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    } else if (sortBy === "rating-desc") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return result;
  }, [filteredGames, sortBy]);
  const visibleGames = useMemo(
    () => sortedGames.slice(0, visibleCount),
    [sortedGames, visibleCount],
  );

  return (
    <Box minH="100vh" bg={bg}>
      <Box maxW="1400px" mx="auto" px={6} py={8}>
        {/* Back navigation & Header */}
        <Flex align="center" gap={4} mb={6}>
          <IconButton
            icon={<ArrowBackIcon />}
            aria-label="Back to Library"
            variant="ghost"
            onClick={() => navigate("/")}
          />
          <Heading size="lg">All Games</Heading>
        </Flex>

        {/* Filters Toolbar */}
        <Flex justify="space-between" align="center" wrap="wrap" gap={4} mb={8}>
          <HStack spacing={4} wrap="wrap" flex={1}>
            <Input
              placeholder="Search library..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              maxW="250px"
              bg={useColorModeValue("white", "gray.800")}
            />
            <Select
              value={selectedProgress}
              onChange={(e) => setSelectedProgress(e.target.value)}
              w="auto"
              minW="170px"
              aria-label="Progress"
              bg={useColorModeValue("white", "gray.800")}
            >
              <option value="all">All Progress</option>
              <option value="none">No Status</option>
              <option value="plan">Plan to Play</option>
              <option value="playing">Playing</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </Select>
            <Select
              value={selectedOwnership}
              onChange={(e) => setSelectedOwnership(e.target.value)}
              w="auto"
              minW="180px"
              aria-label="Ownership"
              bg={useColorModeValue("white", "gray.800")}
            >
              <option value="all">All sources</option>
              <option value="owned">From Steam / Epic</option>
              <option value="manual">Added by me</option>
            </Select>
            <Select
              value={selectedInstallation}
              onChange={(e) => setSelectedInstallation(e.target.value)}
              w="auto"
              minW="180px"
              aria-label="Installation"
              bg={useColorModeValue("white", "gray.800")}
            >
              <option value="all">All Installation</option>
              <option value="installed">Installed</option>
              <option value="uninstalled">Not Installed</option>
            </Select>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              w="auto"
              minW="210px"
              aria-label="Sort by"
              bg={useColorModeValue("white", "gray.800")}
            >
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
              <option value="date-desc">Date Added (Newest)</option>
              <option value="date-asc">Date Added (Oldest)</option>
              <option value="rating-desc">Rating (Highest)</option>
            </Select>
          </HStack>

          {/* Grid/List layout toggle */}
          <ButtonGroup isAttached variant="outline" size="md">
            <IconButton
              icon={<FiGrid />}
              aria-label="Grid View"
              colorScheme={viewMode === "grid" ? "purple" : undefined}
              onClick={() => setViewMode("grid")}
            />
            <IconButton
              icon={<FiList />}
              aria-label="List View"
              colorScheme={viewMode === "list" ? "purple" : undefined}
              onClick={() => setViewMode("list")}
            />
          </ButtonGroup>
        </Flex>

        {loading ? (
          <Flex
            minH="50vh"
            justify="center"
            align="center"
            direction="column"
            gap={4}
          >
            <Spinner size="xl" thickness="4px" speed="0.6s" />
            <Text color="gray.500">Loading library...</Text>
          </Flex>
        ) : error ? (
          <Text color="red.500" textAlign="center" py={10}>
            {error}
          </Text>
        ) : sortedGames.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={10}>
            No games found.
          </Text>
        ) : (
          /* Game Grid / List Output */
          <Box w="100%">
            {viewMode === "grid" ? (
              <SimpleGrid
                columns={{ base: 1, sm: 2, md: 3, lg: 4 }}
                spacing={6}
              >
                {visibleGames.map((game) => (
                  <GameCard
                    key={game._id}
                    game={game}
                    onLaunch={openLaunchModal}
                    onStatusChange={updateStatus}
                    isRunning={runningGames.has(game._id)}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <VStack spacing={3} align="stretch">
                {visibleGames.map((game) => (
                  <GameListRow
                    key={game._id}
                    game={game}
                    onLaunch={openLaunchModal}
                    onStatusChange={updateStatus}
                     isRunning={runningGames.has(game._id)}
                  />
                ))}
              </VStack>
            )}
          </Box>
        )}
        {sortedGames.length > visibleCount && (
          <Button mt={6} onClick={() => setVisibleCount((v) => v + 24)}>
            Load More ({sortedGames.length - visibleCount} more)
          </Button>
        )}

        {/* Interactive Overlay Modals */}
        <ReviewModal
          game={reviewGame}
          review={currentReview}
          isOpen={!!reviewGame}
          onClose={closeReviewModal}
          onSave={saveReview}
          onDelete={deleteReviewHandler}
        />
        <CreateCollectionModal
          isOpen={isCreateCollectionOpen}
          onClose={() => setIsCreateCollectionOpen(false)}
          onCreate={createCollection}
        />
      </Box>
    </Box>
  );
}
