import { Request, Response } from "express";
import LibraryGame from "../library/LibraryGame";
import Review from "../review/Reviewmodel";

const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;

    const games = await LibraryGame.find({
      userId: userId,
    });
        const continuePlaying = await LibraryGame.find({
      userId: userId,
      progressStatus: "playing",
    }).limit(5);
    const recentGames = await LibraryGame.find({
      userId: userId,
    })
      .sort({
        createdAt: -1,
      })
      .limit(5);
    const featuredGame = await LibraryGame.findOne({
      userId: userId,
    }).sort({
      createdAt: -1,
    });
    const reviews = await Review.find({
      userId,
    });
    const reviewsWritten = reviews.length;
    const averageRating =
      reviews.length > 0
        ? (
            reviews.reduce((sum, review) => sum + review.rating, 0) /
            reviews.length
          ).toFixed(1)
        : "0";
    const highestReview = reviews.sort((a, b) => b.rating - a.rating)[0];
    let highestRatedGame = null;

    if (highestReview) {
      highestRatedGame = await LibraryGame.findById(highestReview.gameId);
    }
    const genreMap: Record<string, number> = {};

    games.forEach((game) => {
      game.tags?.forEach((tag: string) => {
        genreMap[tag] = (genreMap[tag] || 0) + 1;
      });
    });

    const genreStats = Object.entries(genreMap)
      .map(([genre, count]) => ({
        genre,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const ownedCount = games.filter((g) => g.providers && Object.keys(g.providers).length > 0).length;
    const installedCount = games.filter((g) => {
      if (!g.providers) return false;
      return Object.values(g.providers).some((p: any) => p.installed === true);
    }).length;

    const statusStats = [
      {
        status: "Owned Games",
        count: ownedCount,
      },
      {
        status: "Installed Games",
        count: installedCount,
      },
      {
        status: "Currently Playing",
        count: games.filter((g) => g.progressStatus === "playing").length,
      },
      {
        status: "Planned",
        count: games.filter((g) => g.progressStatus === "plan").length,
      },
      {
        status: "Completed",
        count: games.filter((g) => g.progressStatus === "completed").length,
      },
      {
        status: "Paused",
        count: games.filter((g) => g.progressStatus === "paused").length,
      },
      {
        status: "Dropped",
        count: games.filter((g) => g.progressStatus === "dropped").length,
      },
    ];

    const stats = {
      totalGames: games.length,

      owned: ownedCount,
      installed: installedCount,
      playing: games.filter((g) => g.progressStatus === "playing").length,

      completed: games.filter((g) => g.progressStatus === "completed").length,

      continuePlaying,

      recentGames,

      genreStats,

      statusStats,
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
