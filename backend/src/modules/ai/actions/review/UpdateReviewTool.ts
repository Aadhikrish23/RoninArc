import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import reviewToolService from "../../services/ReviewToolService";

interface UpdateReviewInput {
  gameId: string;
  rating: number;
  reviewText?: string;
}

export class UpdateReviewTool extends BaseTool<
  UpdateReviewInput,
  Awaited<ReturnType<typeof reviewToolService.upsertReview>>
> {
  readonly category = "review";

  readonly name = "update_review";

  readonly description =
    "Creates or updates a review with a rating and optional text for a game.";

  async execute(
    input: UpdateReviewInput,
    context: AIToolContext,
  ): Promise<AIToolResult<Awaited<ReturnType<typeof reviewToolService.upsertReview>>>> {
    const review = await reviewToolService.upsertReview(
      context.userId,
      input.gameId,
      input.rating,
      input.reviewText,
    );

    if (!review) {
      return this.failure("Failed to update review.");
    }

    return this.success(review, "Review updated successfully.");
  }
}
