import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import reviewToolService from "../../services/ReviewToolService";

interface DeleteReviewInput {
  gameId: string;
}

export class DeleteReviewTool extends BaseTool<
  DeleteReviewInput,
  Awaited<ReturnType<typeof reviewToolService.deleteReview>>
> {
  readonly category = "review";

  readonly name = "delete_review";

  readonly description = "Deletes a review for a game.";

  async execute(
    input: DeleteReviewInput,
    context: AIToolContext,
  ): Promise<AIToolResult<Awaited<ReturnType<typeof reviewToolService.deleteReview>>>> {
    const review = await reviewToolService.deleteReview(
      context.userId,
      input.gameId,
    );

    if (!review) {
      return {
        success: false,
        error: "Review not found.",
      };
    }

    return {
      success: true,
      message: "Review deleted successfully.",
      data: review,
    };
  }
}
