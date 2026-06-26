import {
  Box,
  Flex,
  Heading,
  Spinner,
  Tag,
  Text,
  useToast,
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";

import { Button } from "@chakra-ui/react";

import { useNavigate } from "react-router-dom";

import { useParams } from "react-router-dom";

import { useGameDetails } from "../hooks/useGameDetails";

import GameDetailHero from "../components/GameDetailHero";
import GameStats from "../components/GameStats";
import GameScreenshots from "../components/GameScreenshots";
import { useLibrary } from "../hooks/useLibrary";
import UserGameStats from "../components/UserGameStats";
import { useEffect, useState, useRef } from "react";
import type { Status, Game } from "../types/library";
import { useCollections } from "../../collections/hooks/useCollections";
import { useReview } from "../../reviews/hooks/useReview";
import { usePlaySession } from "../../playSession/hooks/usePlaySession";
import * as reviewApi from "../../reviews/api/reviewApi";
import type { Review } from "../../reviews/types/review";
import LaunchModal from "../components/LaunchModal";
import ReviewModal from "../../reviews/components/ReviewModal";
import libraryApi from "../api/libraryApi";
import activityApi from "../../activity/api/activityApi";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from "@chakra-ui/react";

export default function GameDetailsPage() {
  const { rawgId } = useParams();

  const { games, setGames, fetchLibrary, addGame, updateStatus, deleteGame } =
    useLibrary();
  const { collections, fetchCollections, addGameToCollection, removeGameFromCollection } =
    useCollections();
  const { startSession, loadGameStats, gameStats } = usePlaySession();

  const navigate = useNavigate();
  const toast = useToast();
  
  const [launchModalGame, setLaunchModalGame] = useState<Game | null>(null);
  const [launchPath, setLaunchPath] = useState<string>("");
  const [userReview, setUserReview] = useState<Review | null>(null);
  
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const isMongoId = /^[0-9a-fA-F]{24}$/.test(rawgId || "");
  const libraryGame = isMongoId
    ? (games.find((g) => g._id === rawgId) ?? null)
    : (games.find((g) => g.rawgId === Number(rawgId)) ?? null);

  const { game, loading, error } = useGameDetails(rawgId, libraryGame);

  const handleAddGame = async () => {
    if (!game) return;

    await addGame({
      rawgId: game.id,
      title: game.name,
      description: game.description,
      imageURL: game.imageURL,
      exePath: "",
      tags: game.genres,
      status: "plan",
    });

    await fetchLibrary();
  };

  const handleDeleteGame = async (gameId: string) => {
    await deleteGame(gameId);
    toast({
      title: "Game Removed",
      description: "Game has been removed from library.",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
    navigate("/");
  };

  const handleStatusChange = async (gameId: string, status: Status) => {
    await updateStatus(gameId, status);
    await fetchLibrary();
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
      await fetchLibrary();

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

  const closeLaunchModal = () => {
    setLaunchModalGame(null);
    setLaunchPath("");
  };

  const handleLaunchClick = async () => {
    if (!libraryGame) return;
    if (libraryGame.exePath) {
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
        await startSession(libraryGame._id);
        const launched = await window.electronAPI.launchGame(
          libraryGame._id,
          libraryGame.exePath,
        );
        if (launched) {
          await activityApi.recordLaunch(libraryGame._id);
        }
        toast({
          title: `Launching ${libraryGame.title}`,
          description: libraryGame.exePath,
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
      setLaunchModalGame(libraryGame);
      setLaunchPath("");
    }
  };

  const updateGameRating = async (gameId: string, rating: number | null) => {
    setGames((prev) =>
      prev.map((g) =>
        g._id === gameId
          ? {
              ...g,
              rating,
            }
          : g,
      ),
    );
    if (rating === null) {
      setUserReview(null);
    } else {
      try {
        const rev = await reviewApi.getReview(gameId);
        setUserReview(rev);
      } catch {
        setUserReview(null);
      }
    }
  };

  const {
    reviewGame,
    currentReview,
    openReviewModal,
    closeReviewModal,
    saveReview,
  } = useReview(updateGameRating);

  const handleReviewClick = () => {
    if (libraryGame) {
      openReviewModal(libraryGame);
    }
  };

  const handleDeleteReviewClick = () => {
    setIsDeleteAlertOpen(true);
  };

  const handleConfirmDeleteReview = async () => {
    setIsDeleteAlertOpen(false);
    if (!libraryGame) return;
    try {
      await reviewApi.deleteReview(libraryGame._id);
      await updateGameRating(libraryGame._id, null);
      toast({
        title: "Review Deleted",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Failed to delete review", error);
      toast({
        title: "Error",
        description: "Failed to delete review",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  useEffect(() => {
    Promise.all([fetchLibrary(), fetchCollections()]);
  }, []);

  useEffect(() => {
    const fetchReviewAndStats = async () => {
      if (libraryGame?._id) {
        try {
          const rev = await reviewApi.getReview(libraryGame._id);
          setUserReview(rev);
        } catch {
          setUserReview(null);
        }
        await loadGameStats(libraryGame._id);
      } else {
        setUserReview(null);
      }
    };
    fetchReviewAndStats();
  }, [libraryGame?._id]);

  if (loading) {
    return (
      <Flex minH="70vh" justify="center" align="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  if (error || !game) {
    return (
      <Box p={8}>
        <Text color="red.500">{error ?? "Game not found"}</Text>
      </Box>
    );
  }

  return (
    <Box maxW="1400px" mx="auto" px={6} py={8}>
      <Flex justify="space-between" mb={6}>
        <Button
          leftIcon={<ArrowBackIcon />}
          variant="ghost"
          onClick={() => navigate(-1)}
        >
          Back
        </Button>

        {!libraryGame && (
          <Button colorScheme="purple" onClick={handleAddGame}>
            Add To Library
          </Button>
        )}
      </Flex>
      {/* Hero */}
      <GameDetailHero game={game} />
      <UserGameStats
        game={libraryGame}
        onReview={handleReviewClick}
        onDeleteReview={handleDeleteReviewClick}
        review={userReview}
        playtimeHours={gameStats?.totalHours ?? 0}
        lastPlayed={gameStats?.lastPlayed ?? null}
        onDelete={handleDeleteGame}
        onStatusChange={handleStatusChange}
        collections={collections}
        onAddToCollection={addGameToCollection}
        onRemoveFromCollection={removeGameFromCollection}
        onLaunch={handleLaunchClick}
      />
      {/* Stats */}
      <GameStats game={game} />

      {/* Description */}
      <Box mt={10}>
        <Heading size="md" mb={4}>
          About
        </Heading>

        <Text color="gray.500" lineHeight="1.8" whiteSpace="pre-wrap">
          {game.description}
        </Text>
      </Box>

      {/* Genres */}
      <Box mt={10}>
        <Heading size="md" mb={4}>
          Genres
        </Heading>

        <Flex wrap="wrap" gap={2}>
          {game.genres.map((genre) => (
            <Tag key={genre}>{genre}</Tag>
          ))}
        </Flex>
      </Box>

      {/* Developers */}
      {game.developers.length > 0 && (
        <Box mt={10}>
          <Heading size="md" mb={4}>
            Developers
          </Heading>

          <Flex wrap="wrap" gap={2}>
            {game.developers.map((developer) => (
              <Tag key={developer}>{developer}</Tag>
            ))}
          </Flex>
        </Box>
      )}

      {/* Publishers */}
      {game.publishers.length > 0 && (
        <Box mt={10}>
          <Heading size="md" mb={4}>
            Publishers
          </Heading>

          <Flex wrap="wrap" gap={2}>
            {game.publishers.map((publisher) => (
              <Tag key={publisher}>{publisher}</Tag>
            ))}
          </Flex>
        </Box>
      )}

      {/* Tags */}
      {game.tags.length > 0 && (
        <Box mt={10}>
          <Heading size="md" mb={4}>
            Tags
          </Heading>

          <Flex wrap="wrap" gap={2}>
            {game.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Flex>
        </Box>
      )}

      {/* Website */}
      {game.website && (
        <Box mt={10}>
          <Heading size="md" mb={4}>
            Official Website
          </Heading>

          <Text
            as="a"
            href={game.website}
            target="_blank"
            rel="noreferrer"
            color="purple.400"
          >
            {game.website}
          </Text>
        </Box>
      )}

      {/* Screenshots */}
      <GameScreenshots screenshots={game.screenshots} />

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
        onDelete={async () => {
          closeReviewModal();
          setIsDeleteAlertOpen(true);
        }}
      />

      <AlertDialog
        isOpen={isDeleteAlertOpen}
        leastDestructiveRef={cancelRef}
        onClose={() => setIsDeleteAlertOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Review?
            </AlertDialogHeader>

            <AlertDialogBody>
              This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={() => setIsDeleteAlertOpen(false)}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleConfirmDeleteReview} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
