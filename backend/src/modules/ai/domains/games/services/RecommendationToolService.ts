import recommendationService from "../../../../recommendation/recommendationService";

export class RecommendationToolService {
  async recommend(userId: string, query?: string) {
    return recommendationService.getRecommendations(userId, { type: "all", limit: 3, query });
  }
}

export default new RecommendationToolService();
