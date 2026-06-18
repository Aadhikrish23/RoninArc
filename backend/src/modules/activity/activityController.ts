import { Request, Response } from "express";
import { Types } from "mongoose";

import activityService from "./activityService";
import gameLibrarymodel from "../library/LibraryGame";

const getRecentActivities = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user.id;

    const activities =
      await activityService.getRecentActivities(
        userId
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
    const userId = req.user.id;

    const { gameId } = req.params;

    const game =
      await gameLibrarymodel.findOne({
        _id: gameId,
        userId: userId,
      });

    if (!game) {
      return res.status(404).json({
        Status: "Failed",
        Message: "Game not found",
      });
    }

    await activityService.createActivity(
      userId,
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