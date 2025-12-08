import mongoose, { ObjectId } from "mongoose";

interface GameLibrary extends mongoose.Document {
  userid: ObjectId;
  title: string;
  description: string;
  tags: string[];
  imageURL: string;
  exePath: string;
  status:string;
  createdAt: Date;
  updatedAt: Date;

}

const gameLibraryschema = new mongoose.Schema<GameLibrary>(
  {
    userid: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Game title is mandatory"],
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
    status:{
      type:String,
      enum: ["plan", "playing", "completed", "dropped"],
      default:"plan"
    }
  },
  {
    timestamps: true,
  }
);

const gameLibrarymodel = mongoose.model<GameLibrary>(
  "GameLibrary",
  gameLibraryschema
);

export default gameLibrarymodel;
