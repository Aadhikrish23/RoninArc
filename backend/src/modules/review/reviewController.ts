import reviewService from "./reviewService";
import { Request, Response } from "express";
import { Types } from "mongoose";
import gameLibrarymodel from "../library/LibraryGame";

const invalidId = (res: Response) =>
  res.status(400).json({ Status: "Failed", Message: "Invalid game id" });

const getReview = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    if (!Types.ObjectId.isValid(gameId)) return invalidId(res);

    const review = await reviewService.getReview(
      userId,
      gameId
    );

    return res.status(200).json({
      Status: "Success",
      Data: review,
    });
  } catch (error) {
    return res.status(500).json({
      Status: "Failed",
      Message: "Failed to fetch review",
    });
  }
};
const upsertReview = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user.id;

    const { gameId } = req.params;

    const {
      rating,
      reviewText,
    } = req.body;

    if (!Types.ObjectId.isValid(gameId)) return invalidId(res);

    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Rating must be a whole number from 1 to 10",
      });
    }

    if (reviewText !== undefined && typeof reviewText !== "string") {
      return res.status(400).json({
        Status: "Failed",
        Message: "Review text must be text",
      });
    }

    const ownsGame = await gameLibrarymodel.exists({ _id: gameId, userId });
    if (!ownsGame) {
      return res.status(404).json({
        Status: "Failed",
        Message: "Game not found in your library",
      });
    }

    const review =
      await reviewService.upsertReview(
        userId,
        gameId,
        rating,
        reviewText
      );

    return res.status(200).json({
      Status: "Success",
      Data: review,
    });
  } catch (error) {
    return res.status(500).json({
      Status: "Failed",
      Message: "Failed to save review",
    });
  }
};
const deleteReview = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user.id;

    const { gameId } = req.params;
    if (!Types.ObjectId.isValid(gameId)) return invalidId(res);

    await reviewService.deleteReview(
      userId,
      gameId
    );

    return res.status(200).json({
      Status: "Success",
      Message: "Review deleted",
    });
  } catch (error) {
    return res.status(500).json({
      Status: "Failed",
      Message: "Failed to delete review",
    });
  }
};

export default {getReview,upsertReview,deleteReview}
