import {
  Box,
  useColorModeValue,
  Heading,
  Flex,
  Button,
  Spinner,
  Text,
  VStack,
  HStack,
} from "@chakra-ui/react";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@chakra-ui/react";

import type { RawgGameResult, Game } from "../types/library";
import LaunchModal from "../components/LaunchModal";
import { useLibrary } from "../hooks/useLibrary";
import { useRawgSearch } from "../hooks/useRawgSearch";
import { useReview } from "../../reviews/hooks/useReview";
import ReviewModal from "../../reviews/components/ReviewModal";

import { useCollection } from "../../collections/hooks/useCollections";

import CreateCollectionModal from "../../collections/components/CreateCollectionModal";

import activityApi from "../../activity/api/activityApi";
import { useAuth } from "../../auth/context/AuthContext";
import LibraryHeader from "../sections/LibraryHeader";
import RawgResultsSection from "../sections/RawgResultsSection";
import RawgSearch from "../components/RawgSearch";
import GameAddedModal from "../components/GameAddedModal";
import { usePlaySession } from "../../playSession/hooks/usePlaySession";
import { getLaunchPath } from "../utils/launch";
import { useProvider } from "../../providers/context/ProviderContext";

import HorizontalSection from "../components/HorizontalSection";
import GameCarousel from "../components/GameCarousel";
import CollectionCarousel from "../components/CollectionCarousel";

function LibraryPage() {
  const {
    games,
    loading,
    error,
    fetchLibrary,
    addGame,
    updateGame,
    deleteGame,
    updateStatus,
    refreshGame,
  } = useLibrary();
  const {
    searchText,
    setSearchText,
    ownedResults,
    discoverResults,
    loading: rawgLoading,
    error: rawgError,
    clearSearch,
  } = useRawgSearch();
  const navigate = useNavigate();
  const [runningGames, setRunningGames] = useState<Set<string>>(new Set());
  const [launchModalGame, setLaunchModalGame] = useState<Game | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [launchPath, setLaunchPath] = useState<string>("");

  const bg = useColorModeValue("gray.50", "gray.900");

  const toast = useToast();
  const { token } = useAuth();
  const { startSession, endSession } = usePlaySession();

  const [addedGameTitle, setAddedGameTitle] = useState("");

  const [showAddedModal, setShowAddedModal] = useState(false);

  const { refreshInstallations } = useProvider("steam");
  const [isRescanning, setIsRescanning] = useState(false);

  const handleRescanInstallations = async () => {
    setIsRescanning(true);
    try {
      const report = await refreshInstallations();
      await fetchLibrary();

      const steamReport = report?.steam || {
        scanned: 0,
        updated: 0,
        installed: 0,
        removed: 0,
      };
      const epicReport = report?.epic || {
        scanned: 0,
        updated: 0,
        installed: 0,
        removed: 0,
      };

      toast({
        title: "Rescan complete",
        description: `Steam: Scanned ${steamReport.scanned}, Installed ${steamReport.installed}, Removed ${steamReport.removed}. Epic: Scanned ${epicReport.scanned}, Installed ${epicReport.installed}, Removed ${epicReport.removed}.`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Rescan failed",
        description: err.message || "Failed to scan PC for installations.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsRescanning(false);
    }
  };

  console.log("Context token:", token);

  const updateGameRating = (gameId: string) => {
    refreshGame(gameId);
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
  } = useCollection();

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
  const handleSearchSubmit = () => {
    if (!searchText.trim()) return;

    setShowSearchResults(true);
  };

  const handleBackToLibrary = () => {
    clearSearch();

    setShowSearchResults(false);
  };
  useEffect(() => {
    fetchLibrary();
    fetchCollections();
  }, [fetchLibrary, fetchCollections]);
  useEffect(() => {
    if (!window.electronAPI?.onGameExited) return;

    const unsubscribe = window.electronAPI.onGameExited(async (gameId) => {
      try {
        console.log("[END SESSION]", gameId);

        await endSession(gameId);
        setRunningGames((prev) => {
          const next = new Set(prev);
          next.delete(gameId);
          return next;
        });

        toast({
          title: "Play session ended",
          status: "success",
        });
      } catch (error) {
        console.error(error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleAddGame = async (rawgGame: RawgGameResult) => {
    await addGame({
      rawgId: rawgGame.id,
      title: rawgGame.name,
      description: rawgGame.description ?? "",
      imageURL: rawgGame.imageURL,
      exePath: "",
      tags: rawgGame.genres,
      progressStatus: "plan",
    });

    setAddedGameTitle(rawgGame.name);

    setShowAddedModal(true);
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

      await updateGame(launchModalGame._id, {
        exePath: selectedPath,
      });

      setLaunchPath(selectedPath);

      toast({
        title: "EXE path updated",
        description: "Launch path saved successfully.",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error: unknown) {
      console.error("Failed to update exe path", error);
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
      setRunningGames((prev) => {
        const next = new Set(prev);
        next.add(launchModalGame._id);
        return next;
      });

      const launched = await window.electronAPI.launchGame(
        launchModalGame._id,
        launchPath,
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
    } catch (error: unknown) {
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

  const handleLaunchLauncher = async (uri: string) => {
    if (!launchModalGame) return;
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
        uri,
      );
      if (launched) {
        await activityApi.recordLaunch(launchModalGame._id);
      }
      toast({
        title: `Launching ${launchModalGame.title}`,
        description: `Launching via URI: ${uri}`,
        status: "info",
        duration: 2000,
        isClosable: true,
      });
      closeLaunchModal();
    } catch (err: unknown) {
      console.error("Failed to launch game via URI", err);
      toast({
        title: "Launch failed",
        description: "Could not start the game via launcher.",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  const handleLaunchClick = async (game: Game) => {
    const path = getLaunchPath(game);
    if (path) {
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
        await startSession(game._id);
        setRunningGames((prev) => {
          const next = new Set(prev);
          next.add(game._id);
          return next;
        });
        const launched = await window.electronAPI.launchGame(game._id, path);
        if (launched) {
          await activityApi.recordLaunch(game._id);
        }
        toast({
          title: `Launching ${game.title}`,
          description: path,
          status: "info",
          duration: 2000,
          isClosable: true,
        });
      } catch (error: unknown) {
        console.error("Failed to launch game", error);
        toast({
          title: "Launch failed",
          description: "Could not start the game.",
          status: "error",
          duration: 2000,
          isClosable: true,
        });
      }
    } else {
      openLaunchModal(game);
    }
  };

  const continuePlayingGames = useMemo(() => {
    return games.filter((g) => g.progressStatus === "playing");
  }, [games]);

  const favoriteGames = useMemo(() => {
    return games.filter(
      (g) => g.rating !== null && g.rating !== undefined && g.rating >= 4,
    );
  }, [games]);

  const recentlyAddedGames = useMemo(() => {
    return [...games]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 20);
  }, [games]);

  const completedGames = useMemo(() => {
    return games.filter((g) => g.progressStatus === "completed");
  }, [games]);

  return (
    <Box minH="100vh" bg={bg}>
      {/* ---------------- MAIN CONTENT ---------------- */}
      <Box maxW="1400px" mx="auto" px={6} py={8}>
        {showSearchResults ? (
          <RawgResultsSection
            searchText={searchText}
            ownedResults={ownedResults}
            discoverResults={discoverResults}
            loading={rawgLoading}
            error={rawgError}
            onAddGame={handleAddGame}
            onLaunchGame={handleLaunchClick}
            onBack={handleBackToLibrary}
          />
        ) : (
          <>
            <RawgSearch
              searchText={searchText}
              onSearchChange={setSearchText}
              ownedResults={ownedResults}
              discoverResults={discoverResults}
              loading={rawgLoading}
              error={rawgError}
              onAddGame={handleAddGame}
              onSearchSubmit={handleSearchSubmit}
            />
            <Flex justify="space-between" align="flex-end" mb={8} mt={4}>
              <LibraryHeader />
              <HStack spacing={3}>
                <Button
                  colorScheme="teal"
                  variant="outline"
                  onClick={handleRescanInstallations}
                  isLoading={isRescanning}
                  loadingText="Scanning..."
                >
                  Rescan PC Games
                </Button>
                <Button
                  colorScheme="purple"
                  onClick={() => navigate("/library/browse")}
                >
                  View All Games
                </Button>
              </HStack>
            </Flex>

            {loading ? (
              <Box w="100%" py={20} textAlign="center" color="gray.500">
                <Spinner size="xl" thickness="4px" speed="0.6s" />
                <Text mt={4}>Loading your dashboard...</Text>
              </Box>
            ) : error ? (
              <Box w="100%" py={10} textAlign="center" color="red.400">
                <Text fontWeight="semibold">Something went wrong!</Text>
                <Text>{error}</Text>
              </Box>
            ) : games.length === 0 ? (
              <Box
                p={10}
                borderWidth="1px"
                borderStyle="dashed"
                borderRadius="xl"
                textAlign="center"
                bg={useColorModeValue("white", "gray.800")}
              >
                <VStack spacing={4}>
                  <Heading size="md">Welcome to your gaming dashboard!</Heading>
                  <Text color="gray.500" maxW="500px">
                    Start search-adding games using the search bar above, or
                    connect your Epic Games account in Settings.
                  </Text>
                  <Button
                    colorScheme="purple"
                    onClick={() => navigate("/settings")}
                  >
                    Go to Settings
                  </Button>
                </VStack>
              </Box>
            ) : (
              <VStack align="stretch" spacing={8}>
                {continuePlayingGames.length > 0 && (
                  <HorizontalSection title="Continue Playing">
                    <GameCarousel
                      games={continuePlayingGames}
                      onLaunch={handleLaunchClick}
                      onStatusChange={updateStatus}
                      runningGames={runningGames}
                    />
                  </HorizontalSection>
                )}

                {favoriteGames.length > 0 && (
                  <HorizontalSection title="Favorites (★ 4+)">
                    <GameCarousel
                      games={favoriteGames}
                     
                      onLaunch={handleLaunchClick}
                      
                      onStatusChange={updateStatus}
                      runningGames={runningGames}
                    />
                  </HorizontalSection>
                )}

                <VStack align="stretch" spacing={4} w="100%" mb={8}>
                  <Flex justify="space-between" align="center">
                    <Heading size="md" fontWeight="bold">
                      Collections
                    </Heading>
                    <Button
                      size="sm"
                      colorScheme="purple"
                      variant="outline"
                      onClick={openCollectionModal}
                    >
                      + New Collection
                    </Button>
                  </Flex>
                  <Box
                    overflowX="auto"
                    py={2}
                    px={1}
                    sx={{
                      "&::-webkit-scrollbar": {
                        display: "none",
                      },
                      msOverflowStyle: "none",
                      scrollbarWidth: "none",
                    }}
                  >
                    <CollectionCarousel
                      collections={collections}
                      onDelete={deleteCollectionHandler}
                      onRemoveGame={removeGameFromCollection}
                    />
                  </Box>
                </VStack>

                <HorizontalSection title="Recently Added">
                   <GameCarousel
                      games={favoriteGames}
                     
                      onLaunch={handleLaunchClick}
                      
                      onStatusChange={updateStatus}
                      runningGames={runningGames}
                    />
                </HorizontalSection>

                {completedGames.length > 0 && (
                  <HorizontalSection title="Completed Games">
                     <GameCarousel
                      games={favoriteGames}
                     
                      onLaunch={handleLaunchClick}
                      
                      onStatusChange={updateStatus}
                      runningGames={runningGames}
                    />
                  </HorizontalSection>
                )}
              </VStack>
            )}
          </>
        )}
        <LaunchModal
          game={launchModalGame}
          launchPath={launchPath}
          onClose={closeLaunchModal}
          onEditPath={handlePickExePath}
          onLaunch={handleLaunchGame}
          onLaunchLauncher={handleLaunchLauncher}
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
        <GameAddedModal
          isOpen={showAddedModal}
          gameTitle={addedGameTitle}
          onContinue={() => {
            setShowAddedModal(false);
          }}
          onViewLibrary={() => {
            setShowAddedModal(false);

            clearSearch();

            setShowSearchResults(false);
          }}
        />
      </Box>
    </Box>
  );
}

export default LibraryPage;
