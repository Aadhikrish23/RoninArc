import Review from "./Reviewmodel";

import mongoose from "mongoose";
import activityService from "../activity/activityService";
import LibraryGame from "../library/LibraryGame";

/** The game's title for activity messages ("Rated Hades 9/10"), or a generic fallback. */
const titleOf = async (userId: string, gameId: string) =>
  ((await LibraryGame.findOne({ _id: gameId, userId }).select("title").lean()) as { title?: string } | null)?.title ?? "a game";

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

  // No text given (e.g. "rate it 9") keeps the existing review text instead of wiping it.
  const cleanText = reviewText === undefined ? existingReview?.reviewText ?? "" : reviewText.trim();
  if (existingReview && existingReview.rating === rating && existingReview.reviewText === cleanText) {
    return existingReview;
  }

  const review = await Review.findOneAndUpdate(
    {
      userId,
      gameId,
    },
    {
      rating,
      reviewText: cleanText,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  );

  await activityService.createActivity(
    userId,
    existingReview ? "REVIEW_UPDATED" : "REVIEW_CREATED",
    existingReview
      ? `Updated rating for ${await titleOf(userId, gameId)} to ${rating}/10`
      : `Rated ${await titleOf(userId, gameId)} ${rating}/10`,
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
      `Deleted review for ${await titleOf(userId, gameId)}`,
      new mongoose.Types.ObjectId(gameId),
    );
  }

  return review;
};
export default { getReview, upsertReview, deleteReview };
