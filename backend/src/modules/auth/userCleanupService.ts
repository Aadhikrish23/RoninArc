import Review from "../review/Reviewmodel";
import Collection from "../collection/CollectionModel";
import Activity from "../activity/ActivityModel";
import PlaySession from "../playSession/PlaySessionModel";
import GameLibrary from "../library/LibraryGame";
import RefreshToken from "./models/RefreshToken";
import Note from "../notes/Notemodel";
import EpicOwnership from "../providers/epic/models/EpicOwnership";

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

    Note.deleteMany({ userId }),

    EpicOwnership.deleteMany({ userId }),
  ]);
}
