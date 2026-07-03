import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import reviewToolService from "../../services/ReviewToolService";

interface CreateReviewInput {
  gameId: string;
  rating: number;
  reviewText?: string;
}

export class CreateReviewTool extends BaseTool<
  CreateReviewInput,
  Awaited<ReturnType<typeof reviewToolService.upsertReview>>
> {
  readonly category = "review";

  readonly name = "create_review";

  readonly description =
    "Creates or updates a review with a rating and optional text for a game.";

  async execute(
    input: CreateReviewInput,
    context: AIToolContext,
  ): Promise<AIToolResult<Awaited<ReturnType<typeof reviewToolService.upsertReview>>>> {
    const review = await reviewToolService.upsertReview(
      context.userId,
      input.gameId,
      input.rating,
      input.reviewText,
    );

    if (!review) {
      return {
        success: false,
        error: "Failed to create review.",
      };
    }

    return {
      success: true,
      message: "Review created successfully.",
      data: review,
    };
  }
}
