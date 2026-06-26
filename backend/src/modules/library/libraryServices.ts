import mongoose from "mongoose";
import gameLibrarymodel from "./LibraryGame";
import AppError from "../../shared/errors/AppError";
import Review from "../review/Reviewmodel";
import Collection from "../collection/CollectionModel";
import activityService from "../activity/activityService";
import metadataEnrichmentService from "./metadataEnrichmentService";

async function addGameToLibrary(
  userId: string,
  payload: Partial<{
      rawgId: number;
    title: string;
    description?: string;
    tags?: string[];
    imageURL?: string;
    exePath?: string;
    status: string;
  }>
) {
  const title = payload.title?.trim();

  const dedupe =
  await gameLibrarymodel.findOne({
    userId,
    rawgId: payload.rawgId,
  });

  if (dedupe) {
    throw new AppError(
      "Game already exists",
      400
    );
  }

  const artworkSources: Record<string, string> = {};
  if (payload.imageURL) {
    artworkSources["manual"] = payload.imageURL;
  }

  const data =
    await gameLibrarymodel.create({
      userId: userId,
      rawgId: payload.rawgId,
      title: payload.title,
      description: payload.description,
      tags: payload.tags,
      exePath: payload.exePath,
      status: payload.status,
      artwork: {
        selectedSource: "manual",
        sources: artworkSources,
      },
    });

  await activityService.createActivity(
    userId,
    "GAME_ADDED",
    `Added ${data.title} to library`,
    data._id as any
  );

  return data.toObject();
}

async function getUserLibrary(userId: string) {
  const games = await gameLibrarymodel.find({ userId });

  const reviews = await Review.find({
    userId: userId,
  }).lean();

  const reviewMap = new Map(
    reviews.map((review) => [
      review.gameId.toString(),
      review.rating,
    ])
  );

  return games.map((game) => {
    const gameObj = game.toJSON();
    return {
      ...gameObj,
      rating:
        reviewMap.get(
          game._id.toString()
        ) || null,
    };
  });
}
async function getGameById(userId: string , gameid:string) {
  const data = await gameLibrarymodel.findOne({ _id: gameid, userId });
  if (!data) {
    return null;
  }
  const status = data.metadataState?.status || "none";
  if (status === "none" || status === "failed") {
    metadataEnrichmentService.enqueueEnrichment(userId, gameid);
  }
  return data.toObject();
}
async function getGameFilter(
  userId: string,
  searchparam: string,
  searchvalue: string
) {
  const data = await gameLibrarymodel.find({
    userId: userId,
    [searchparam]: searchvalue,
  });
  if (!data) {
    return null;
  }
  return data.map((g) => g.toObject());
}

async function updateGame(
  userId: string,
  gameid: string,
  payload: Partial<{
    tags?: string[];
    exePath?: string;
    status?: string;
  }>
) {
  const oldGame =
    await gameLibrarymodel.findOne({
      _id: gameid,
      userId: userId,
    });

  const data =
    await gameLibrarymodel.findOneAndUpdate(
      {
        _id: gameid,
        userId: userId,
      },
      payload,
      {
        new: true,
        runValidators: true,
      }
    );

  if (!data) {
    return null;
  }

  if (
    payload.status &&
    oldGame &&
    oldGame.status !== payload.status
  ) {
    await activityService.createActivity(
      userId,
      "STATUS_CHANGED",
      `${data.title} marked as ${payload.status}`,
      data._id as any
    );
  }

  return data.toObject();
}

async function deleteGame(
  userId: string,
  gameid: string
) {
  const data =
    await gameLibrarymodel.findOneAndDelete({
      _id: gameid,
      userId,
    });

  if (!data) {
    return null;
  }

  await Collection.updateMany(
    {
      userId: userId,
    },
    {
      $pull: {
        gameIds: gameid,
      },
    }
  );

  await Review.deleteMany({
    userId: userId,
    gameId: gameid,
  });

  await activityService.createActivity(
    userId,
    "GAME_REMOVED",
    `Removed ${data.title} from library`
  );

  return data.toObject();
}


export default {
  addGameToLibrary,
  getUserLibrary,
  getGameFilter,
  getGameById,
  updateGame,
  deleteGame,
};
