import {
  Box,
  useColorModeValue,
} from "@chakra-ui/react";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@chakra-ui/react";

import type { RawgGameResult, Game } from "../types/library";
import libraryApi from "../api/libraryApi";
import LaunchModal from "../components/LaunchModal";
import { useLibrary } from "../hooks/useLibrary";
import { useRawgSearch } from "../hooks/useRawgSearch";
import { useReview } from "../../reviews/hooks/useReview";
import ReviewModal from "../../reviews/components/ReviewModal";

import { useCollections } from "../../collections/hooks/useCollections";

import CreateCollectionModal from "../../collections/components/CreateCollectionModal";

import activityApi from "../../activity/api/activityApi";
import { useAuth } from "../../auth/context/AuthContext";
import { getErrorMessage } from "../../../shared/utils/error";
import LibraryHeader from "../sections/LibraryHeader";
import LibraryGamesSection from "../sections/LibraryGamesSection";
import CollectionsSection from "../sections/CollectionsSection";

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
  const { token } = useAuth();

  console.log("Context token:", token);

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
      } catch (error: unknown) {
        setError(getErrorMessage(error));
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
    } catch (error: unknown) {
      console.error("Failed to update exe path", error);
      setError(getErrorMessage(error));
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

  return (
    <Box minH="100vh" bg={bg}>
      {/* ---------------- MAIN CONTENT ---------------- */}
      <Box maxW="1200px" mx="auto" px={6} py={8}>
        <LibraryHeader />

        <LibraryGamesSection
          searchText={searchText}
          onSearchChange={setSearchText}
          rawgResults={rawgResults}
          rawgLoading={rawgLoading}
          rawgError={rawgError}
          onAddGame={handleAddGame}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          loading={loading}
          error={error}
          filteredGames={filteredGames}
          collections={collections}
          onDeleteGame={handleDeleteGame}
          onLaunch={openLaunchModal}
          onReview={openReviewModal}
          onGameStatusChange={updateStatus}
          onAddToCollection={addGameToCollection}
          onOpenCollectionModal={openCollectionModal}
        />

        <CollectionsSection
          collections={collections}
          onDelete={deleteCollectionHandler}
          onRemoveGame={removeGameFromCollection}
        />

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
