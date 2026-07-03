// TEMP DEBUG ONLY

import { IGameLibrary } from "../../library/LibraryGame";
import mongoose from "mongoose";

export type LibraryGame = Omit<IGameLibrary, keyof mongoose.Document> & {
  _id: mongoose.Types.ObjectId | string;
  rating?: number | null;
};
