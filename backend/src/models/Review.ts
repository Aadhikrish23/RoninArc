// backend/src/models/Review.ts
import mongoose from "mongoose";
export interface ReviewDocument extends Document {
  userId: mongoose.Types.ObjectId;

  gameId: mongoose.Types.ObjectId;

  rating: number;

  reviewText?: string;

  createdAt: Date;

  updatedAt: Date;
}
const reviewSchema = new mongoose.Schema<ReviewDocument>(
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

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },

    reviewText: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

reviewSchema.index(
  {
    userId: 1,
    gameId: 1,
  },
  {
    unique: true,
  },
);

export default mongoose.model("Review", reviewSchema);
