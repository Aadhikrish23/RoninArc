import mongoose, { Document, Types } from "mongoose";

export interface IActivity extends Document {
  userId: Types.ObjectId;

  type: string;

  message: string;

  gameId?: Types.ObjectId;

  collectionId?: Types.ObjectId;

  createdAt: Date;

  updatedAt: Date;
}

const activitySchema = new mongoose.Schema<IActivity>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    type: {
      type: String,
      required: true,
      enum: [
        "GAME_ADDED",
        "GAME_REMOVED",

        "STATUS_CHANGED",

        "REVIEW_CREATED",
        "REVIEW_UPDATED",
        "REVIEW_DELETED",

        "COLLECTION_CREATED",
        "COLLECTION_DELETED",

        "GAME_ADDED_TO_COLLECTION",
        "GAME_REMOVED_FROM_COLLECTION",

        "GAME_LAUNCHED",
      ],
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameLibrary",
    },

    collectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IActivity>("Activity", activitySchema);
