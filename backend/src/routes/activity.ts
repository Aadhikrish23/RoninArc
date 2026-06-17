import express from "express";

import authMiddleware from "../middleware/authMiddleware";

import activityController from "../controllers/activityController";

const activityRouter =
  express.Router();

activityRouter.use(
  authMiddleware
);

activityRouter.get(
  "/",
  activityController.getRecentActivities
);

activityRouter.post(
  "/launch/:gameId",
  activityController.recordLaunch
);

export default activityRouter;