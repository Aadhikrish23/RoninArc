import mongoose from "mongoose";
import { tombstonePlugin } from "../sync/tombstonePlugin";

export interface NoteDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;

  gameId: mongoose.Types.ObjectId;

  content: string;

  createdAt: Date;

  updatedAt: Date;
}

const noteSchema = new mongoose.Schema<NoteDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },

    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "GameLibrary",
    },

    content: {
      type: String,
      required: [true, "Note content is required"],
      trim: true,
      maxLength: 2000,
    },
  },
  {
    timestamps: true,
  },
);

noteSchema.index({ userId: 1, gameId: 1 });

// Deletions are recorded so sync can pass them on (modules/sync).
noteSchema.plugin(tombstonePlugin, { coll: "notes" });

export default mongoose.model<NoteDocument>("Note", noteSchema);
