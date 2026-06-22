import { Types } from "mongoose";

import PlaySession from "./PlaySessionModel";

const startSession = async (userId: Types.ObjectId, gameId: string) => {
  const existingSession = await PlaySession.findOne({
    userId,
    gameId,
    endedAt: null,
  }).sort({
    startedAt: -1,
  });

  if (existingSession) {
    return existingSession;
  }

  return PlaySession.create({
    userId,
    gameId,
  });
};

const endSession = async (userId: Types.ObjectId, gameId: string) => {
  const session = await PlaySession.findOne({
    userId,
    gameId,
    endedAt: null,
  }).sort({
    startedAt: -1,
  });

  if (!session) {
    return null;
  }

  const endedAt = new Date();

  const durationMinutes = Math.floor(
    (endedAt.getTime() - session.startedAt.getTime()) / (1000 * 60),
  );

  session.endedAt = endedAt;

  session.durationMinutes = durationMinutes;

  await session.save();

  return session;
};

const getRecentSessions = async (userId: Types.ObjectId, limit = 10) => {
  return PlaySession.find({
    userId,
  })
    .populate("gameId")
    .sort({
      startedAt: -1,
    })
    .limit(limit);
};

const getUserPlaytimeStats = async (userId: Types.ObjectId) => {
  const sessions = await PlaySession.find({
    userId,
  });

  const totalMinutes = sessions.reduce(
    (sum, session) => sum + session.durationMinutes,
    0,
  );

  const completedSessions = sessions.filter(
    (session) => session.endedAt !== null,
  );
  const totalSessions = completedSessions.length;

  const averageSessionMinutes =
    completedSessions.length > 0
      ? Math.round(totalMinutes / completedSessions.length)
      : 0;

  const mostPlayed = await PlaySession.aggregate([
    {
      $match: { userId },
    },
    {
      $group: {
        _id: "$gameId",
        totalMinutes: {
          $sum: "$durationMinutes",
        },
      },
    },
    {
      $sort: {
        totalMinutes: -1,
      },
    },
    {
      $limit: 1,
    },
    {
      $lookup: {
        from: "gamelibraries",
        localField: "_id",
        foreignField: "_id",
        as: "game",
      },
    },
    {
      $unwind: "$game",
    },
  ]);

  return {
    totalMinutes,

    totalHours: Number((totalMinutes / 60).toFixed(1)),

    totalSessions,

    averageSessionMinutes,

    mostPlayedGame: mostPlayed[0]?.game || null,

    mostPlayedMinutes: mostPlayed[0]?.totalMinutes || 0,
  };
};

const getGamePlaytime = async (userId: Types.ObjectId, gameId: string) => {
  const sessions = await PlaySession.find({
    userId,
    gameId: new Types.ObjectId(gameId),
  });

  const totalMinutes = sessions.reduce(
    (sum, session) => sum + (session.durationMinutes || 0),
    0,
  );

  const lastSession = await PlaySession.findOne({
    userId,
    gameId: new Types.ObjectId(gameId),
  }).sort({
    startedAt: -1,
  });

  return {
    totalHours: Number((totalMinutes / 60).toFixed(1)),
    lastPlayed: lastSession ? lastSession.startedAt : null,
  };
};

export default {
  startSession,

  endSession,

  getRecentSessions,

  getUserPlaytimeStats,

  getGamePlaytime,
};

