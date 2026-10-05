/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
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
import { useEffect, useState, useRef, useCallback } from "react";
import type { Status } from "../types/library";
import { eventBus } from "../../../shared/events/EventBus";
import { useCollection } from "../../collections/hooks/useCollections";
import { useReview } from "../../reviews/hooks/useReview";
import { usePlaySession } from "../../playSession/hooks/usePlaySession";
import * as reviewApi from "../../reviews/api/reviewApi";
import type { Review } from "../../reviews/types/review";
import LaunchModal from "../components/LaunchModal";
import ReviewModal from "../../reviews/components/ReviewModal";
import NotesSection from "../../notes/components/NotesSection";
import { useNotes } from "../../notes/hooks/useNotes";

import { useLaunchGame } from "../../library/hooks/useLaunchGame";

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

  const {
    games,
    fetchLibrary,
    addGame,
    updateStatus,
    deleteGame,
    refreshGame,
  } = useLibrary();
  const {
    collections,
    fetchCollections,
    addGameToCollection,
    removeGameFromCollection,
  } = useCollection();
  const { loadGameStats, gameStats } = usePlaySession();
  const { openLaunchModal, modalProps,runningGames } = useLaunchGame();
  const navigate = useNavigate();
  const toast = useToast();

  const [userReview, setUserReview] = useState<Review | null>(null);

  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [isRemoveGameOpen, setIsRemoveGameOpen] = useState(false);
  const cancelRemoveRef = useRef<HTMLButtonElement>(null);

  const isMongoId = /^[0-9a-fA-F]{24}$/.test(rawgId || "");
  const libraryGame = isMongoId
    ? (games.find((g) => g._id === rawgId) ?? null)
    : (games.find((g) => g.rawgId === Number(rawgId)) ?? null);

  const { game, loading, error } = useGameDetails(rawgId, libraryGame);
  const { notes, loading: notesLoading, saving: notesSaving, addNote, removeNote } = useNotes(libraryGame?._id);

  const handleAddGame = async () => {
    if (!game) return;

    await addGame({
      rawgId: game.id,
      title: game.name,
      description: game.description,
      imageURL: game.imageURL,
      exePath: "",
      tags: game.genres,
      progressStatus: "plan",
    });
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
  };

  const updateGameRating = async (gameId: string, rating: number | null) => {
    await refreshGame(gameId);
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
    // Collections live in a shared context that only the Library page used to
    // load, so a direct visit/refresh here showed an empty "Add To Collection".
    Promise.all([fetchLibrary(), fetchCollections()]);
  }, []);

  const fetchReviewAndStats = useCallback(async () => {
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
  }, [libraryGame, loadGameStats]);

  useEffect(() => {
    fetchReviewAndStats();
  }, [fetchReviewAndStats]);

  useEffect(() => {
    const unsubscribeReview = eventBus.subscribe("review.updated", () => {
      fetchReviewAndStats();
    });
    const unsubscribeLibrary = eventBus.subscribe("library.updated", () => {
      fetchReviewAndStats();
    });
    return () => {
      unsubscribeReview();
      unsubscribeLibrary();
    };
  }, [fetchReviewAndStats]);

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
    onDelete={() => setIsRemoveGameOpen(true)}
    onStatusChange={handleStatusChange}
    collections={collections}
    onAddToCollection={addGameToCollection}
    onRemoveFromCollection={removeGameFromCollection}
    onLaunch={() => {
        if (libraryGame) {
            openLaunchModal(libraryGame);
        }
    }}
    isRunning={
        libraryGame
            ? runningGames.has(libraryGame._id)
            : false
    }
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

      {/* Notes */}
      {libraryGame && (
        <NotesSection
          notes={notes}
          loading={notesLoading}
          saving={notesSaving}
          onAdd={addNote}
          onDelete={removeNote}
        />
      )}

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

      <LaunchModal {...modalProps} />
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

            <AlertDialogBody>This action cannot be undone.</AlertDialogBody>

            <AlertDialogFooter>
              <Button
                ref={cancelRef}
                onClick={() => setIsDeleteAlertOpen(false)}
              >
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleConfirmDeleteReview}
                ml={3}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      <AlertDialog
        isOpen={isRemoveGameOpen}
        leastDestructiveRef={cancelRemoveRef}
        onClose={() => setIsRemoveGameOpen(false)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Remove {game.name} from your library?
            </AlertDialogHeader>

            <AlertDialogBody>
              Its review, notes and collection memberships will be removed too. This action cannot be undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRemoveRef} onClick={() => setIsRemoveGameOpen(false)}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                ml={3}
                onClick={async () => {
                  setIsRemoveGameOpen(false);
                  if (libraryGame) await handleDeleteGame(libraryGame._id);
                }}
              >
                Remove
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
