import api from "../../../shared/api/axiosInstance";

import type { Review } from "../types/review";

export const getReview = async (
  gameId: string
): Promise<Review | null> => {
  const response =
    await api.get(`/review/${gameId}`);

  return response.data.Data;
};

export const saveReview = async (
  gameId: string,
  rating: number,
  reviewText: string
): Promise<Review> => {
  const response =
    await api.put(`/review/${gameId}`, {
      rating,
      reviewText,
    });

  return response.data.Data;
};

export const deleteReview = async (
  gameId: string
): Promise<void> => {
  await api.delete(`/review/${gameId}`);
};