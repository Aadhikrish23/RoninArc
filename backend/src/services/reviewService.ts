import Review from "../models/Review";




 const getReview = async (
  userId: string,
  gameId: string
) => {
  return Review.findOne({
    userId,
    gameId,
  });
};


 const upsertReview = async (
  userId: string,
  gameId: string,
  rating: number,
  reviewText?: string
) => {
  return Review.findOneAndUpdate(
    {
      userId,
      gameId,
    },
    {
      rating,
      reviewText: reviewText?.trim() || "",
    },
    {
      new: true,
      upsert: true,
    }
  );
};



 const deleteReview = async (
  userId: string,
  gameId: string
) => {
  return Review.findOneAndDelete({
    userId,
    gameId,
  });
};
export default {getReview,upsertReview,deleteReview}