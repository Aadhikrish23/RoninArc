import {
  Box,
  Flex,
  Heading,
  Text,
  SimpleGrid,
  useColorModeValue,
  Spinner,
} from "@chakra-ui/react";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@chakra-ui/react";
// import { getCurrentUser } from "../utils/auth";
import Navbar from "../components/Navbar";
import GameCard from "../features/library/components/GameCard";
import StatusFilter from "../features/library/components/StatusFilter";

import RawgSearch from "../features/library/components/RawgSearch";
import type { RawgGameResult, Game } from "../types/library";
import libraryApi from "../features/library/api/libraryApi";
import LaunchModal from "../features/library/components/LaunchModal";
import { useLibrary } from "../features/library/hooks/useLibrary";
import { useRawgSearch } from "../features/library/hooks/useRawgSearch";
import { useReview } from "../features/reviews/hooks/useReview";
import ReviewModal from "../features/reviews/components/ReviewModal";
import { Button } from "@chakra-ui/react";

import { useCollections } from "../features/collections/hooks/useCollections";

import CreateCollectionModal from "../features/collections/components/CreateCollectionModal";

import CollectionCard from "../features/collections/components/CollectionCard";
import activityApi from "../features/activity/api/activityApi";

function LibraryPage() {
  const { games, setGames, fetchLibrary, addGame, deleteGame, updateStatus } =
    useLibrary();
  const {
    searchText,
    setSearchText,

    results: rawgResults,

    loading: rawgLoading,

    error: rawgError,

    clearSearch,
  } = useRawgSearch();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [launchModalGame, setLaunchModalGame] = useState<Game | null>(null);

  const [launchPath, setLaunchPath] = useState<string>("");

  const bg = useColorModeValue("gray.50", "gray.900");

  const toast = useToast();

  const updateGameRating = (gameId: string, rating: number | null) => {
    setGames((prev) =>
      prev.map((game) =>
        game._id === gameId
          ? {
              ...game,
              rating,
            }
          : game,
      ),
    );
  };
  const handleDeleteGame = async (gameId: string) => {
    await deleteGame(gameId);

    removeGameEverywhere(gameId);
  };
  const {
    collections,
    fetchCollections,

    createCollection,

    deleteCollection: deleteCollectionHandler,

    addGameToCollection,
    removeGameFromCollection,

    removeGameEverywhere,
  } = useCollections();

  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const {
    reviewGame,
    currentReview,

    openReviewModal,
    closeReviewModal,

    saveReview,
    deleteReview: deleteReviewHandler,
  } = useReview(updateGameRating);
  const openLaunchModal = (game: Game) => {
    setLaunchModalGame(game);
    setLaunchPath(game.exePath || "");
  };

  const closeLaunchModal = () => {
    setLaunchModalGame(null);
    setLaunchPath("");
  };
  const openCollectionModal = () => {
    setIsCreateCollectionOpen(true);
  };

  const closeCollectionModal = () => {
    setIsCreateCollectionOpen(false);
  };
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        setLoading(true);
        setError(null);

        await Promise.all([fetchLibrary(), fetchCollections()]);
      } catch (error: any) {
        setError(error.toString());
      } finally {
        setLoading(false);
      }
    };

    loadLibrary();
  }, []);

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchStatus =
        selectedStatus === "all" || game.status === selectedStatus;

      const matchSearch = game.title
        .toLowerCase()
        .includes(searchText.toLowerCase());

      return matchStatus && matchSearch;
    });
  }, [games, selectedStatus, searchText]);

  const handleAddGame = async (rawgGame: RawgGameResult) => {
    await addGame(rawgGame);

    clearSearch();
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
      if (!selectedPath) return; // user cancelled

      if (!launchModalGame) return;

      await libraryApi.updateGame(launchModalGame._id, {
        exePath: selectedPath,
      });

      setLaunchPath(selectedPath);
      setGames((prev) =>
        prev.map((g) =>
          g._id === launchModalGame._id ? { ...g, exePath: selectedPath } : g,
        ),
      );

      toast({
        title: "EXE path updated",
        description: "Launch path saved successfully.",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error: any) {
      console.error("Failed to update exe path", error);
      setError(error.toString());
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
      const launched = await window.electronAPI.launchGame(launchPath);

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
    } catch (error: any) {
      console.error("Failed to launch game", error);
      toast({
        title: "Launch failed",
        description: "Could not start the game.",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  return (
    <Box minH="100vh" bg={bg}>
      <Navbar />
      {/* ---------------- MAIN CONTENT ---------------- */}
      <Box maxW="1200px" mx="auto" px={6} py={8}>
        {/* Header */}
        <Flex direction="column" gap={2} mb={6}>
          <Heading size="lg">My Library</Heading>
          <Text fontSize="sm" color="gray.500">
            Track your gaming progress and backlog.
          </Text>
        </Flex>

        <RawgSearch
          searchText={searchText}
          onSearchChange={setSearchText}
          results={rawgResults}
          loading={rawgLoading}
          error={rawgError}
          onAddGame={handleAddGame}
        />

        {/* ---------------- STATUS FILTERS ---------------- */}
        <StatusFilter
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
        />
        <Flex mb={6}>
          <Button colorScheme="purple" onClick={openCollectionModal}>
            New Collection
          </Button>
        </Flex>

        {/* ---------------- GAME GRID ---------------- */}
        {loading ? (
          <Box
            w="100%"
            py={10}
            textAlign="center"
            color="gray.500"
            fontSize="lg"
          >
            <Spinner size="xl" thickness="4px" speed="0.6s" />
            <Text mt={4}>Loading your library...</Text>
          </Box>
        ) : error ? (
          <Box
            w="100%"
            py={10}
            textAlign="center"
            color="red.400"
            fontSize="md"
            borderWidth="1px"
            borderColor="red.300"
            borderRadius="lg"
            bg="red.50"
            _dark={{
              bg: "red.900",
              borderColor: "red.700",
              color: "red.200",
            }}
          >
            <Text fontWeight="semibold">Something went wrong!</Text>
            <Text>{error}</Text>
          </Box>
        ) : filteredGames.length === 0 ? (
          <Box
            p={6}
            borderWidth="1px"
            borderStyle="dashed"
            borderRadius="lg"
            textAlign="center"
          >
            <Text>No games found.</Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={5}>
            {filteredGames.map((game) => (
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
        )}
        <Box mt={10}>
          <Heading size="md" mb={4}>
            Collections
          </Heading>

          {collections.length === 0 ? (
            <Text color="gray.500">No collections created yet.</Text>
          ) : (
            <SimpleGrid
              columns={{
                base: 1,
                sm: 2,
                md: 3,
              }}
              spacing={4}
            >
              {collections.map((collection) => (
                <CollectionCard
                  key={collection._id}
                  collection={collection}
                  onDelete={deleteCollectionHandler}
                  onRemoveGame={removeGameFromCollection}
                />
              ))}
            </SimpleGrid>
          )}
        </Box>
        {/* -------- Launch Modal -------- */}
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
          onClose={closeCollectionModal}
          onCreate={async (name, description) => {
            await createCollection(name, description);

            closeCollectionModal();
          }}
        />
      </Box>
    </Box>
  );
}

export default LibraryPage;
