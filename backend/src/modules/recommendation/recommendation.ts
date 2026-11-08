import express from "express";
import authMiddleware from "../auth/authMiddleware";
import recommendationController from "./recommendationController";

const recommendationRouter = express.Router();

recommendationRouter.use(authMiddleware);
recommendationRouter.get("/", recommendationController.getRecommendations);
recommendationRouter.post("/dismiss", recommendationController.dismiss);
recommendationRouter.delete("/dismiss/:igdbId", recommendationController.undoDismiss);

export default recommendationRouter;
