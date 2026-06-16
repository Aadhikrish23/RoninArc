import { Types } from "mongoose";

import Collection from "../models/Collection";

const createCollection = async (
  userId: Types.ObjectId,
  name: string,
  description?: string
) => {
  const existingCollection =
    await Collection.findOne({
      userId,
      name: name.trim(),
    });

  if (existingCollection) {
    throw new Error(
      "Collection with this name already exists"
    );
  }

  const collection =
    await Collection.create({
      userId,
      name: name.trim(),
      description:
        description?.trim() || "",
    });

  return collection;
};

const getCollections = async (
  userId: Types.ObjectId
) => {
  return await Collection.find({
    userId,
  })
    .populate("gameIds")
    .sort({
      createdAt: -1,
    });
};

const getCollectionById = async (
  userId: Types.ObjectId,
  collectionId: string
) => {
  const collection =
    await Collection.findOne({
      _id: collectionId,
      userId,
    }).populate("gameIds");

  if (!collection) {
    throw new Error(
      "Collection not found"
    );
  }

  return collection;
};

const addGameToCollection =
  async (
    userId: Types.ObjectId,
    collectionId: string,
    gameId: string
  ) => {
    const collection =
      await Collection.findOneAndUpdate(
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
        }
      ).populate("gameIds");

    if (!collection) {
      throw new Error(
        "Collection not found"
      );
    }

    return collection;
  };

const removeGameFromCollection =
  async (
    userId: Types.ObjectId,
    collectionId: string,
    gameId: string
  ) => {
    const collection =
      await Collection.findOneAndUpdate(
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
        }
      ).populate("gameIds");

    if (!collection) {
      throw new Error(
        "Collection not found"
      );
    }

    return collection;
  };

const deleteCollection =
  async (
    userId: Types.ObjectId,
    collectionId: string
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