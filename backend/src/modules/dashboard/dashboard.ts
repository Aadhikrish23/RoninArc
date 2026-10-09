import express from "express";
import authMiddleware from "../auth/authMiddleware";
import dashboardcontroller from "./dashboardcontroller";

const dashboardRouter = express.Router();

dashboardRouter.get(
  "/stats",
  authMiddleware,
  dashboardcontroller.getDashboardStats
);

dashboardRouter.get(
  "/overview",
  authMiddleware,
  dashboardcontroller.getDashboardOverview
);

export default dashboardRouter;