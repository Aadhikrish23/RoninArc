import { Request, Response } from "express";
import { Types } from "mongoose";

import activityService from "../services/activityService";
import gameLibrarymodel from "../models/LibraryGame";

const getRecentActivities = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = (req as any).user.id;

    const activities =
      await activityService.getRecentActivities(
        new Types.ObjectId(userId)
      );

    return res.status(200).json({
      Status: "Success",
      Data: activities,
    });
  } catch {
    return res.status(500).json({
      Status: "Failed",
      Message: "Failed to load activities",
    });
  }
};

const recordLaunch = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = (req as any).user.id;

    const { gameId } = req.params;

    const game =
      await gameLibrarymodel.findOne({
        _id: gameId,
        userid: userId,
      });

    if (!game) {
      return res.status(404).json({
        Status: "Failed",
        Message: "Game not found",
      });
    }

    await activityService.createActivity(
      new Types.ObjectId(userId),
      "GAME_LAUNCHED",
      `Launched ${game.title}`,
      game._id as any
    );

    return res.status(200).json({
      Status: "Success",
    });
  } catch {
    return res.status(500).json({
      Status: "Failed",
      Message: "Failed to record launch",
    });
  }
};

export default {
  getRecentActivities,
  recordLaunch,
};