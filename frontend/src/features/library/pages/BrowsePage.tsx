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
  useToast,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiGrid, FiList } from "react-icons/fi";
import { ArrowBackIcon } from "@chakra-ui/icons";

import type { Game } from "../types/library";
import libraryApi from "../api/libraryApi";
import GameCard from "../components/GameCard";
import GameListRow from "../components/GameListRow";
import LaunchModal from "../components/LaunchModal";
import ReviewModal from "../../reviews/components/ReviewModal";
import CreateCollectionModal from "../../collections/components/CreateCollectionModal";
import GameAddedModal from "../components/GameAddedModal";

import { useLibrary } from "../hooks/useLibrary";
import { useReview } from "../../reviews/hooks/useReview";
import { useCollections } from "../../collections/hooks/useCollections";
import { usePlaySession } from "../../playSession/hooks/usePlaySession";
import activityApi from "../../activity/api/activityApi";
import { getErrorMessage } from "../../../shared/utils/error";

export default function BrowsePage() {
  const { games, setGames, fetchLibrary, deleteGame, updateStatus } = useLibrary();
  const { collections, fetchCollections, addGameToCollection, createCollection } = useCollections();
  const { startSession, endSession } = usePlaySession();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Filters State
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [sortBy, setSortBy] = useState("title-asc");

  // Modals State
  const [launchModalGame, setLaunchModalGame] = useState<Game | null>(null);
  const [launchPath, setLaunchPath] = useState("");
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [showAddedModal, setShowAddedModal] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();
  const bg = useColorModeValue("gray.50", "gray.900");

  const updateGameRating = (gameId: string, rating: number | null) => {
    setGames((prev) =>
      prev.map((game) =>
        game._id === gameId ? { ...game, rating } : game
      )
    );
  };

  const {
    reviewGame,
    currentReview,
    openReviewModal,
    closeReviewModal,
    saveReview,
    deleteReview: deleteReviewHandler,
  } = useReview(updateGameRating);

  const handleDeleteGame = async (gameId: string) => {
    await deleteGame(gameId);
  };

  const openLaunchModal = (game: Game) => {
    setLaunchModalGame(game);
    setLaunchPath(game.exePath || "");
  };

  const closeLaunchModal = () => {
    setLaunchModalGame(null);
    setLaunchPath("");
  };

  const handlePickExePath = async () => {
    if (!window.electronAPI?.selectExePath) {
      toast({
        title: "Desktop only",
        description: "EXE path editing works only inside the Electron app.",
        status: "warning",
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    try {
      const selectedPath = await window.electronAPI.selectExePath();
      if (!selectedPath) return;

      if (!launchModalGame) return;

      await libraryApi.updateGame(launchModalGame._id, {
        exePath: selectedPath,
      });

      setLaunchPath(selectedPath);
      setGames((prev) =>
        prev.map((g) =>
          g._id === launchModalGame._id ? { ...g, exePath: selectedPath } : g
        )
      );

      toast({
        title: "EXE path updated",
        description: "Launch path saved successfully.",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (err: unknown) {
      console.error("Failed to update exe path", err);
      toast({
        title: "Update failed",
        description: "Could not update EXE path.",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleLaunchGame = async () => {
    if (!launchModalGame) return;

    if (!launchPath) {
      toast({
        title: "No EXE path set",
        description: "Please choose an EXE path before launching.",
        status: "warning",
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    if (!window.electronAPI?.launchGame) {
      toast({
        title: "Desktop only",
        description: "Launching is only available inside the Electron app.",
        status: "warning",
        duration: 2500,
        isClosable: true,
      });
      return;
    }

    try {
      await startSession(launchModalGame._id);

      const launched = await window.electronAPI.launchGame(
        launchModalGame._id,
        launchPath
      );

      if (launched) {
        await activityApi.recordLaunch(launchModalGame._id);
      }

      toast({
        title: `Launching ${launchModalGame.title}`,
        description: launchPath,
        status: "info",
        duration: 2000,
        isClosable: true,
      });

      closeLaunchModal();
    } catch (err: unknown) {
      console.error("Failed to launch game", err);
      toast({
        title: "Launch failed",
        description: "Could not start the game.",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    const loadLibrary = async () => {
      try {
        setLoading(true);
        setError(null);
        await Promise.all([fetchLibrary(), fetchCollections()]);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onGameExited) return;

    window.electronAPI.onGameExited(async (gameId) => {
      try {
        await endSession(gameId);
        toast({
          title: "Play session ended",
          status: "success",
        });
      } catch (err) {
        console.error(err);
      }
    });
  }, []);

  // Filtered & Sorted Games list
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchStatus =
        selectedStatus === "all" || game.status === selectedStatus;

      const matchSearch = game.title
        .toLowerCase()
        .includes(searchText.toLowerCase());

      const matchPlatform =
        selectedPlatform === "all" ||
        (selectedPlatform === "epic" && game.provider === "epic") ||
        (selectedPlatform === "manual" && (!game.provider || game.provider === "manual")) ||
        (game.provider === selectedPlatform);

      return matchStatus && matchSearch && matchPlatform;
    });
  }, [games, selectedStatus, searchText, selectedPlatform]);

  const sortedGames = useMemo(() => {
    const result = [...filteredGames];
    if (sortBy === "title-asc") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "title-desc") {
      result.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortBy === "date-desc") {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "date-asc") {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === "rating-desc") {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    return result;
  }, [filteredGames, sortBy]);

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
              maxW="300px"
              bg={useColorModeValue("white", "gray.800")}
            />
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              maxW="150px"
              bg={useColorModeValue("white", "gray.800")}
            >
              <option value="all">All Statuses</option>
              <option value="plan">Plan to Play</option>
              <option value="playing">Playing</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </Select>
            <Select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              maxW="180px"
              bg={useColorModeValue("white", "gray.800")}
            >
              <option value="all">All Platforms</option>
              <option value="epic">Epic Games</option>
              <option value="manual">Manual / Local</option>
            </Select>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              maxW="180px"
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
              isActive={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
            />
            <IconButton
              icon={<FiList />}
              aria-label="List View"
              isActive={viewMode === "list"}
              onClick={() => setViewMode("list")}
            />
          </ButtonGroup>
        </Flex>

        {/* Loading / Error States */}
        {loading ? (
          <Box w="100%" py={20} textAlign="center" color="gray.500">
            <Spinner size="xl" thickness="4px" speed="0.6s" />
            <Text mt={4}>Loading your library catalog...</Text>
          </Box>
        ) : error ? (
          <Box
            w="100%"
            py={10}
            textAlign="center"
            color="red.400"
            borderWidth="1px"
            borderColor="red.300"
            borderRadius="lg"
            bg="red.50"
            _dark={{ bg: "red.900", borderColor: "red.700" }}
          >
            <Text fontWeight="semibold">Something went wrong!</Text>
            <Text>{error}</Text>
          </Box>
        ) : sortedGames.length === 0 ? (
          <Box p={10} borderWidth="1px" borderStyle="dashed" borderRadius="lg" textAlign="center">
            <Text color="gray.500">No games matched your active filters.</Text>
          </Box>
        ) : (
          /* Game Grid / List Output */
          <Box w="100%">
            {viewMode === "grid" ? (
              <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
                {sortedGames.map((game) => (
                  <GameCard
                    key={game._id}
                    game={game}
                    collections={collections}
                    onDelete={handleDeleteGame}
                    onStatusChange={updateStatus}
                    onLaunch={openLaunchModal}
                    onReview={openReviewModal}
                    onAddToCollection={addGameToCollection}
                  />
                ))}
              </SimpleGrid>
            ) : (
              <VStack spacing={3} align="stretch">
                {sortedGames.map((game) => (
                  <GameListRow
                    key={game._id}
                    game={game}
                    onLaunch={openLaunchModal}
                    onStatusChange={updateStatus}
                  />
                ))}
              </VStack>
            )}
          </Box>
        )}

        {/* Interactive Overlay Modals */}
        <LaunchModal
          game={launchModalGame}
          launchPath={launchPath}
          onClose={closeLaunchModal}
          onEditPath={handlePickExePath}
          onLaunch={handleLaunchGame}
        />
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
          onCreate={async (name, description) => {
            await createCollection(name, description);
            setIsCreateCollectionOpen(false);
          }}
        />
        <GameAddedModal
          isOpen={showAddedModal}
          gameTitle=""
          onContinue={() => setShowAddedModal(false)}
          onViewLibrary={() => setShowAddedModal(false)}
        />
      </Box>
    </Box>
  );
}
