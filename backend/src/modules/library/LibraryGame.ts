import mongoose from "mongoose";

export interface IGameLibrary extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  rawgId: number;
  title: string;
  description: string;
  tags: string[];
  imageURL: string;
  exePath: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const gameLibraryschema = new mongoose.Schema<IGameLibrary>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Game title is mandatory"],
    },
    rawgId: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      required: [true, "Game title is mandatory"],
      trim: true,
    },
    description: {
      type: String,
    },
    tags: {
      type: [String],
    },
    imageURL: {
      type: String,
    },
    exePath: {
      type: String,
    },
    status: {
      type: String,
      enum: ["plan", "playing", "completed", "dropped"],
      default: "plan",
    },
  },
  {
    timestamps: true,
  },
);

const gameLibrarymodel = mongoose.model<IGameLibrary>(
  "GameLibrary",
  gameLibraryschema,
);

export default gameLibrarymodel;
