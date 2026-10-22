import mongoose, { Document, Types } from "mongoose";
import { tombstonePlugin } from "../sync/tombstonePlugin";

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

        "GAME_LAUNCHED","COLLECTION_UPDATED",

        "NOTE_CREATED",
        "NOTE_DELETED",
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

// Deletions are recorded so sync can pass them on (modules/sync).
activitySchema.plugin(tombstonePlugin, { coll: "activities" });

export default mongoose.model<IActivity>("Activity", activitySchema);
