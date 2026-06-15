import { useState } from "react";
import { useToast } from "@chakra-ui/react";

import type { Game } from "../../../types/library";
import type { Review } from "../types/review";

import * as reviewApi from "../api/reviewAPI"

export function useReview() {
  const toast = useToast();

  const [reviewGame, setReviewGame] =
    useState<Game | null>(null);

  const [currentReview, setCurrentReview] =
    useState<Review | null>(null);

  const openReviewModal = async (
    game: Game
  ) => {
    try {
      setReviewGame(game);

      const review =
        await reviewApi.getReview(
          game._id
        );

      setCurrentReview(review);
    } catch {
      setCurrentReview(null);
    }
  };

  const closeReviewModal = () => {
    setReviewGame(null);
    setCurrentReview(null);
  };

  const saveReview = async (
    rating: number,
    reviewText: string
  ) => {
    if (!reviewGame) return;

    const saved =
      await reviewApi.saveReview(
        reviewGame._id,
        rating,
        reviewText
      );

    setCurrentReview(saved);

    toast({
      title: "Review Saved",
      status: "success",
      duration: 2000,
      isClosable: true,
    });

    closeReviewModal();
  };

  const deleteReview = async () => {
    if (!reviewGame) return;

    await reviewApi.deleteReview(
      reviewGame._id
    );

    toast({
      title: "Review Deleted",
      status: "success",
      duration: 2000,
      isClosable: true,
    });

    closeReviewModal();
  };

  return {
    reviewGame,
    currentReview,

    openReviewModal,
    closeReviewModal,

    saveReview,
    deleteReview,
  };
}