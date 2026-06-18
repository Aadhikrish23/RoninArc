import Review from "./Reviewmodel";

import mongoose from "mongoose";
import activityService from "../activity/activityService";

const getReview = async (userId: string, gameId: string) => {
  return Review.findOne({
    userId,
    gameId,
  });
};

const upsertReview = async (
  userId: string,
  gameId: string,
  rating: number,
  reviewText?: string,
) => {
  const existingReview = await Review.findOne({
    userId,
    gameId,
  });

  const review = await Review.findOneAndUpdate(
    {
      userId,
      gameId,
    },
    {
      rating,
      reviewText: reviewText?.trim() || "",
    },
    {
      new: true,
      upsert: true,
    },
  );

  await activityService.createActivity(
    userId,
    existingReview ? "REVIEW_UPDATED" : "REVIEW_CREATED",
    existingReview
      ? `Updated review (${rating}/10)`
      : `Reviewed a game (${rating}/10)`,
    new mongoose.Types.ObjectId(gameId),
  );

  return review;
};

const deleteReview = async (userId: string, gameId: string) => {
  const review = await Review.findOneAndDelete({
    userId,
    gameId,
  });

  if (review) {
    await activityService.createActivity(
      userId,
      "REVIEW_DELETED",
      "Deleted a review",
      new mongoose.Types.ObjectId(gameId),
    );
  }

  return review;
};
export default { getReview, upsertReview, deleteReview };
