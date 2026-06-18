import express from "express";

import authMiddleware from "../auth/authMiddleware";

import reviewController from "./reviewController";

const reviewRouter = express.Router();

reviewRouter.get(
  "/:gameId",
  authMiddleware,
  reviewController.getReview
);

reviewRouter.put(
  "/:gameId",
  authMiddleware,
  reviewController.upsertReview
);

reviewRouter.delete(
  "/:gameId",
  authMiddleware,
  reviewController.deleteReview
);

export default reviewRouter;