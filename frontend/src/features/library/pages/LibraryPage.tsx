import { canLaunchGames } from "../../../shared/utils/runtime";
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
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@chakra-ui/react";

import type { RawgGameResult } from "../types/library";
import { useLibrary } from "../hooks/useLibrary";
import { useRawgSearch } from "../hooks/useRawgSearch";
import { useReview } from "../../reviews/hooks/useReview";
import ReviewModal from "../../reviews/components/ReviewModal";

import { useCollection } from "../../collections/hooks/useCollections";

import CreateCollectionModal from "../../collections/components/CreateCollectionModal";

import LibraryHeader from "../sections/LibraryHeader";
import RawgResultsSection from "../sections/RawgResultsSection";
import RawgSearch from "../components/RawgSearch";
import { useProvider } from "../../providers/context/ProviderContext";

import HorizontalSection from "../components/HorizontalSection";
import GameCarousel from "../components/GameCarousel";
import CollectionCarousel from "../components/CollectionCarousel";
import { useLaunchGame } from "../hooks/useLaunchGame";
import RecommendedStrip from "../../recommendations/components/RecommendedStrip";

function LibraryPage() {
  const {
    games,
    loading,
    error,
    fetchLibrary,
    addGame,
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
    searchedText,
    performSearch,
  } = useRawgSearch();
  const navigate = useNavigate();

  const [showSearchResults, setShowSearchResults] = useState(false);

  const bg = useColorModeValue("gray.50", "gray.900");

  const toast = useToast();



  const { refreshInstallations } = useProvider("steam");
  const [isRescanning, setIsRescanning] = useState(false);
  const { openLaunchModal, runningGames } = useLaunchGame();

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

  const updateGameRating = (gameId: string) => {
    refreshGame(gameId);
  };
  const {
    collections,
    fetchCollections,

    createCollection,

    deleteCollection: deleteCollectionHandler,

    removeGameFromCollection,
  } = useCollection();

  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const {
    reviewGame,
    currentReview,

    closeReviewModal,

    saveReview,
    deleteReview: deleteReviewHandler,
  } = useReview(updateGameRating);

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

  // The navbar's "Library" (or logo) while already here: back to the library itself.
  const location = useLocation();
  const libraryHome = (location.state as { libraryHome?: number } | null)?.libraryHome;
  useEffect(() => {
    if (libraryHome) handleBackToLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryHome]);

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

    // addGame already updates the library and shows a toast; refresh the
    // results quietly so the added game moves to "In your library".
    await performSearch({ silent: true });
  };
  const continuePlayingGames = useMemo(() => {
    return games.filter((g) => g.progressStatus === "playing");
  }, [games]);

  // Ratings are out of 10.
  const favoriteGames = useMemo(() => {
    return games.filter(
      (g) => g.rating !== null && g.rating !== undefined && g.rating >= 8,
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
          <>
          <RawgSearch
            searchText={searchText}
            onSearchChange={setSearchText}
            ownedResults={ownedResults}
            discoverResults={discoverResults}
            loading={rawgLoading}
            error={rawgError}
            searchedText={searchedText}
            onAddGame={handleAddGame}
            onSearchSubmit={handleSearchSubmit}
          />
          <RawgResultsSection
            searchText={searchText}
            ownedResults={ownedResults}
            discoverResults={discoverResults}
            loading={rawgLoading}
            error={rawgError}
            onAddGame={handleAddGame}
            onLaunchGame={openLaunchModal}
            onBack={handleBackToLibrary}
          />
          </>
        ) : (
          <>
            <RawgSearch
              searchText={searchText}
              onSearchChange={setSearchText}
              ownedResults={ownedResults}
              discoverResults={discoverResults}
              loading={rawgLoading}
              error={rawgError}
              searchedText={searchedText}
              onAddGame={handleAddGame}
              onSearchSubmit={handleSearchSubmit}
            />
            <Flex justify="space-between" align="flex-end" mb={8} mt={4}>
              <LibraryHeader />
              <HStack spacing={3}>
                {canLaunchGames() && (
                  <Button
                    colorScheme="purple"
                    variant="outline"
                    onClick={handleRescanInstallations}
                    isLoading={isRescanning}
                    loadingText="Scanning..."
                  >
                    Rescan PC Games
                  </Button>
                )}
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
                  <Heading size="md">Your library is empty</Heading>
                  <Text color="gray.500" maxW="520px">
                    Search for a game above and click Add (press Enter to see
                    all results), or connect Steam or Epic Games to import everything you own.
                  </Text>
                  <Button
                    colorScheme="purple"
                    onClick={() => navigate("/settings")}
                  >
                    Connect Steam or Epic
                  </Button>
                </VStack>
              </Box>
            ) : (
              <VStack align="stretch" spacing={8}>
                {continuePlayingGames.length > 0 && (
                  <HorizontalSection title="Continue Playing">
                    <GameCarousel
                      games={continuePlayingGames}
                      onLaunch={openLaunchModal}
                      onStatusChange={updateStatus}
                      runningGames={runningGames}
                    />
                  </HorizontalSection>
                )}

                <RecommendedStrip />

                {favoriteGames.length > 0 && (
                  <HorizontalSection title="Favorites (rated 8+)">
                    <GameCarousel
                      games={favoriteGames}
                      onLaunch={openLaunchModal}
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
                    games={recentlyAddedGames}
                    onLaunch={openLaunchModal}
                    onStatusChange={updateStatus}
                    runningGames={runningGames}
                  />
                </HorizontalSection>

                {completedGames.length > 0 && (
                  <HorizontalSection title="Completed Games">
                    <GameCarousel
                      games={completedGames}
                      onLaunch={openLaunchModal}
                      onStatusChange={updateStatus}
                      runningGames={runningGames}
                    />
                  </HorizontalSection>
                )}
              </VStack>
            )}
          </>
        )}
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
