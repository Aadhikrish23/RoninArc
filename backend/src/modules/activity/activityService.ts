import { Types } from "mongoose";

import Activity from "./ActivityModel";

const createActivity = async (
  userId: string,
  type:
  | "GAME_ADDED"
  | "GAME_REMOVED"

  | "STATUS_CHANGED"

  | "REVIEW_CREATED"
  | "REVIEW_UPDATED"
  | "REVIEW_DELETED"

  | "COLLECTION_CREATED"
  | "COLLECTION_DELETED"

  | "GAME_ADDED_TO_COLLECTION"
  | "GAME_REMOVED_FROM_COLLECTION"

  | "GAME_LAUNCHED"
  | "COLLECTION_UPDATED",
  message: string,
  gameId?: Types.ObjectId,
  collectionId?: Types.ObjectId
) => {
  return Activity.create({
    userId,
    type,
    message,
    gameId,
    collectionId,
  });
};

const getRecentActivities = async (
  userId: string,
  limit = 20
) => {
  return Activity.find({
    userId,
  })
    .sort({
      createdAt: -1,
    })
    .limit(limit)
    .populate("gameId")
    .populate("collectionId");
};

export default {
  createActivity,
  getRecentActivities,
};