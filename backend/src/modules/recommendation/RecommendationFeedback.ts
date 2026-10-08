import mongoose from "mongoose";

// A RAWG game the user said "Not interested" to, so discovery stops suggesting it.
const recommendationFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rawgId: { type: Number, required: true },
    title: { type: String, default: "", trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

recommendationFeedbackSchema.index({ userId: 1, rawgId: 1 }, { unique: true });

export default mongoose.model("RecommendationFeedback", recommendationFeedbackSchema);
