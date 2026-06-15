import express from "express";
import authMiddleware from "../middleware/authMiddleware";
import dashboardcontroller from "../controllers/dashboardcontroller";

const dashboardRouter = express.Router();

dashboardRouter.get(
  "/stats",
  authMiddleware,
  dashboardcontroller.getDashboardStats
);

export default dashboardRouter;