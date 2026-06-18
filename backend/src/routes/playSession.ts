import express from "express";

import authMiddleware from "../middleware/authMiddleware";

import {
  startSession,
  endSession,
  getRecentSessions,
  getPlaytimeStats,
} from "../controllers/playSessionController";

const router = express.Router();

router.use(authMiddleware);

router.post("/start/:gameId", startSession);

router.post("/end/:gameId", endSession);

router.get("/recent", getRecentSessions);

router.get("/stats", getPlaytimeStats);

export default router;
