import { Request, Response } from "express";
import { Types } from "mongoose";

import playSessionService from "./playSessionService";

export const startSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const { gameId } = req.params;

    if (!Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Invalid game id",
      });
    }
    const session = await playSessionService.startSession(
      new Types.ObjectId(userId),
      gameId,
    );

    return res.status(200).json({
      Status: "Success",
      Data: session,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({
      Status: "Failed",
      Message: message || "Failed to start session",
    });
  }
};

export const endSession = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const { gameId } = req.params;

    if (!Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Invalid game id",
      });
    }

    const session = await playSessionService.endSession(
      new Types.ObjectId(userId),
      gameId,
    );

    if (!session) {
      return res.status(404).json({
        Status: "Failed",
        Message: "No active session found",
      });
    }

    return res.status(200).json({
      Status: "Success",
      Data: session,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(400).json({
      Status: "Failed",
      Message: message || "Failed to end session",
    });
  }
};

export const getRecentSessions = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const limit = Math.max(1, Math.min(Number(req.query.limit || 10), 50));

    const sessions = await playSessionService.getRecentSessions(
      new Types.ObjectId(userId),
      limit,
    );

    return res.status(200).json({
      Status: "Success",
      Data: sessions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      Status: "Failed",
      Message: message || "Failed to fetch sessions",
    });
  }
};

export const getPlaytimeStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const stats = await playSessionService.getUserPlaytimeStats(
      new Types.ObjectId(userId),
    );

    return res.status(200).json({
      Status: "Success",
      Data: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      Status: "Failed",
      Message: message || "Failed to fetch playtime stats",
    });
  }
};

export const getGamePlaytime = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;

    if (!Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({
        Status: "Failed",
        Message: "Invalid game id",
      });
    }

    const stats = await playSessionService.getGamePlaytime(
      new Types.ObjectId(userId),
      gameId,
    );

    return res.status(200).json({
      Status: "Success",
      Data: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({
      Status: "Failed",
      Message: message || "Failed to fetch game playtime stats",
    });
  }
};

