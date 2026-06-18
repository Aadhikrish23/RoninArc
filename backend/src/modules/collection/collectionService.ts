import { Types } from "mongoose";

import Collection from "./CollectionModel";
import activityService from "../activity/activityService";
import gameLibrarymodel from "../library/LibraryGame";

const createCollection = async (
  userId: string,
  name: string,
  description?: string,
) => {
  const existingCollection = await Collection.findOne({
    userId,
    name: name.trim(),
  });

  if (existingCollection) {
    throw new Error("Collection with this name already exists");
  }

  const collection = await Collection.create({
    userId,
    name: name.trim(),
    description: description?.trim() || "",
  });
  await activityService.createActivity(
    userId,
    "COLLECTION_CREATED",
    `Created collection "${collection.name}"`,
    undefined,
    collection._id as any,
  );

  return collection;
};

const getCollections = async (userId: string) => {
  return await Collection.find({
    userId,
  })
    .populate("gameIds")
    .sort({
      createdAt: -1,
    });
};

const getCollectionById = async (
  userId: string,
  collectionId: string,
) => {
  const collection = await Collection.findOne({
    _id: collectionId,
    userId,
  }).populate("gameIds");

  if (!collection) {
    throw new Error("Collection not found");
  }

  return collection;
};

const addGameToCollection = async (
  userId: string,
  collectionId: string,
  gameId: string,
) => {
  const collection = await Collection.findOneAndUpdate(
    {
      _id: collectionId,
      userId,
    },
    {
      $addToSet: {
        gameIds: gameId,
      },
    },
    {
      new: true,
    },
  ).populate("gameIds");

  if (!collection) {
    throw new Error("Collection not found");
  }
  const game = await gameLibrarymodel.findById(
  gameId
);
  
  await activityService.createActivity(
    userId,
    "GAME_ADDED_TO_COLLECTION",
    `Added ${game?.title||"Game"} to ${collection.name}`,
    new Types.ObjectId(gameId),
    new Types.ObjectId(collectionId),
  );

  return collection;
};

const removeGameFromCollection = async (
  userId: string,
  collectionId: string,
  gameId: string,
) => {
  const collection = await Collection.findOneAndUpdate(
    {
      _id: collectionId,
      userId,
    },
    {
      $pull: {
        gameIds: gameId,
      },
    },
    {
      new: true,
    },
  ).populate("gameIds");

  if (!collection) {
    throw new Error("Collection not found");
  }
   const game = await gameLibrarymodel.findById(
  gameId
);
await activityService.createActivity(
  userId,
  "GAME_REMOVED_FROM_COLLECTION",
  `Removed ${game?.title || "Game"} from ${collection.name}`,
  new Types.ObjectId(gameId),
  new Types.ObjectId(collectionId),
);

  return collection;
};

const deleteCollection = async (
  userId: string,
  collectionId: string,
) => {
  const collection =
    await Collection.findOneAndDelete({
      _id: collectionId,
      userId,
    });

  if (!collection) {
    throw new Error(
      "Collection not found"
    );
  }

  await activityService.createActivity(
    userId,
    "COLLECTION_DELETED",
    `Deleted collection "${collection.name}"`,
    undefined,
    collection._id as any,
  );

  return collection;
};

export default {
  createCollection,

  getCollections,

  getCollectionById,

  addGameToCollection,

  removeGameFromCollection,

  deleteCollection,
};
