import reviewService from "../../review/reviewService";

export class ReviewToolService {
  /**
   * Fetches an existing review for a game.
   */
  async getReview(
    userId: string,
    gameId: string,
  ): Promise<Awaited<ReturnType<typeof reviewService.getReview>>> {
    return reviewService.getReview(userId, gameId);
  }

  /**
   * Creates or updates a review (upsert) for a game.
   */
  async upsertReview(
    userId: string,
    gameId: string,
    rating: number,
    reviewText?: string,
  ): Promise<Awaited<ReturnType<typeof reviewService.upsertReview>>> {
    return reviewService.upsertReview(userId, gameId, rating, reviewText);
  }

  /**
   * Deletes a review for a game.
   */
  async deleteReview(
    userId: string,
    gameId: string,
  ): Promise<Awaited<ReturnType<typeof reviewService.deleteReview>>> {
    return reviewService.deleteReview(userId, gameId);
  }
}

export default new ReviewToolService();
