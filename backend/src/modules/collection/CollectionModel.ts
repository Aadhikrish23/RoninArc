import mongoose, { Document, Types } from "mongoose";
import { tombstonePlugin } from "../sync/tombstonePlugin";
export interface ICollection extends Document {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  gameIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const collectionSchema = new mongoose.Schema<ICollection>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    gameIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GameLibrary",
      },
    ],
  },
  {
    timestamps: true,
  },
);

collectionSchema.index(
  {
    userId: 1,
    name: 1,
  },
  {
    unique: true,
  },
);

// Deletions are recorded so sync can pass them on (modules/sync).
collectionSchema.plugin(tombstonePlugin, { coll: "collections" });

export default mongoose.model("Collection", collectionSchema);
