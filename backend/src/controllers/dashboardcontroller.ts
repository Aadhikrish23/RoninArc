import { Request, Response } from "express";
import LibraryGame from "../models/LibraryGame";

const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const games = await LibraryGame.find({
      userid: userId,
    });
    const continuePlaying = await LibraryGame.find({
      userid: userId,
      status: "playing",
    }).limit(5);
    const recentGames = await LibraryGame.find({
      userid: userId,
    })
      .sort({
        createdAt: -1,
      })
      .limit(5);
    const featuredGame = await LibraryGame.findOne({
      userid: userId,
    }).sort({
      createdAt: -1,
    });
    const stats = {
      totalGames: games.length,
      playing: games.filter((g) => g.status === "playing").length,

      completed: games.filter((g) => g.status === "completed").length,

      dropped: games.filter((g) => g.status === "dropped").length,

      plan: games.filter((g) => g.status === "plan").length,
      continuePlaying:continuePlaying,
      recentGames:recentGames,
      featuredGame:featuredGame

    };

    return res.status(200).json(stats);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to load dashboard stats",
    });
  }
};

export default {
  getDashboardStats,
};
