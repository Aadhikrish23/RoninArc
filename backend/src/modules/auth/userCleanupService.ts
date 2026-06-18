import Review from "../review/Reviewmodel";
import Collection from "../collection/CollectionModel";
import Activity from "../activity/ActivityModel";
import PlaySession from "../playSession/PlaySessionModel";
import GameLibrary from "../library/LibraryGame";
import RefreshToken from "./models/RefreshToken";

export async function deleteUserData(userId: string) {
  await Promise.all([
    Review.deleteMany({ userId }),

    Collection.deleteMany({
      userId,
    }),

    Activity.deleteMany({
      userId,
    }),

    PlaySession.deleteMany({
      userId,
    }),

    GameLibrary.deleteMany({
      userId: userId,
    }),

    RefreshToken.deleteMany({
      userId,
    }),
  ]);
}
