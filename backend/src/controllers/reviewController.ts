import reviewService from "../services/reviewService";
import { Request, Response } from "express";
const getReview = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = (req as any).user.id;
    const { gameId } = req.params;

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
    const userId = (req as any).user.id;

    const { gameId } = req.params;

    const {
      rating,
      reviewText,
    } = req.body;

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
    const userId = (req as any).user.id;

    const { gameId } = req.params;

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