import mongoose, { ObjectId } from "mongoose";
import gameLibrarymodel from "../models/LibraryGame";
import AppError from "../utils/AppError";
import Review from "../models/Review";
import Collection from "../models/Collection";

async function addGameToLibrary(
  userId: ObjectId,
  payload: Partial<{
    title: string;
    description?: string;
    tags?: string[];
    imageURL?: string;
    exePath?: string;
    status: string;
  }>
) {
  const title = payload.title?.trim();
  const dedupe = await gameLibrarymodel.find({ userid: userId, title: title });
  if (dedupe.length > 0) {
    throw new AppError("Game already exist", 400);
  }
  const data = await gameLibrarymodel.create({ userid: userId, ...payload });
  return data;
}

async function getUserLibrary(userid: ObjectId) {
  const games = await gameLibrarymodel
    .find({ userid })
    .lean();

  const reviews = await Review.find({
    userId: userid,
  }).lean();

  const reviewMap = new Map(
    reviews.map((review) => [
      review.gameId.toString(),
      review.rating,
    ])
  );

  return games.map((game) => ({
    ...game,
    rating:
      reviewMap.get(
        game._id.toString()
      ) || null,
  }));
}
async function getGameById(userid: ObjectId , gameid:string) {
  const data = await gameLibrarymodel.findOne({ _id: gameid, userid });
    if (!data) {
    return null;
  }
  return data;
}
async function getGameFilter(
  userid: ObjectId,
  searchparam: string,
  searchvalue: string
) {
  const data = await gameLibrarymodel.find({
    userid: userid,
    [searchparam]: searchvalue,
  });
  if (!data) {
    return null;
  }
  return data;
}

async function updateGame(
  userId: ObjectId,
  gameid:string,
  payload: Partial<{
    tags?: string[];
    exePath?: string;
    status?: string;
  }>
) {
  const data = await gameLibrarymodel.findOneAndUpdate(
    { _id: gameid, userid: userId },
    payload,
    {
      new: true,
      runValidators: true,
    }
  );
  if (!data) {
    return null;
  }
  return data;
}

async function deleteGame(
  userid: ObjectId,
  gameid: string
) {
  const data =
    await gameLibrarymodel.findOneAndDelete({
      _id: gameid,
      userid,
    });

  if (!data) {
    return null;
  }

  await Collection.updateMany(
    {
      userId: userid,
    },
    {
      $pull: {
        gameIds: gameid,
      },
    }
  );

  await Review.deleteMany({
    userId: userid,
    gameId: gameid,
  });

  return data;
}

export default {
  addGameToLibrary,
  getUserLibrary,
  getGameFilter,
  getGameById,
  updateGame,
  deleteGame,
};
