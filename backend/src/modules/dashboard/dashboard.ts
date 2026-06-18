import express from "express";
import authMiddleware from "../auth/authMiddleware";
import dashboardcontroller from "./dashboardcontroller";

const dashboardRouter = express.Router();

dashboardRouter.get(
  "/stats",
  authMiddleware,
  dashboardcontroller.getDashboardStats
);

export default dashboardRouter;