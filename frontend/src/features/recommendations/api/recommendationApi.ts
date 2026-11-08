import api from "../../../shared/api/axiosInstance";
import type { RecommendationResult, RecommendationType } from "../types/recommendation";

const getRecommendations = async (params: {
  type?: RecommendationType;
  limit?: number;
  q?: string;
}): Promise<RecommendationResult> => {
  const response = await api.get<{ Data: RecommendationResult }>("/recommendations", { params });
  return response.data.Data;
};

const dismiss = async (igdbId: number, title: string): Promise<void> => {
  await api.post("/recommendations/dismiss", { igdbId, title });
};

const undoDismiss = async (igdbId: number): Promise<void> => {
  await api.delete(`/recommendations/dismiss/${igdbId}`);
};

export default { getRecommendations, dismiss, undoDismiss };
