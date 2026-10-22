import { Types } from "mongoose";
import LibraryGame from "../../../../library/LibraryGame";
import Collection from "../../../../collection/CollectionModel";
import type { LibrarySnapshot } from "../../../context/LibrarySnapshot";

const MAX_GAMES = 300;

/** The user's games (newest first) and collections, for the planner and the rules. */
export async function loadLibrarySnapshot(userId: string): Promise<LibrarySnapshot> {
  const uid = new Types.ObjectId(userId);
  const [games, totalGames, collections] = await Promise.all([
    LibraryGame.find({ userId: uid }).sort({ createdAt: -1 }).limit(MAX_GAMES).select("title progressStatus").lean(),
    LibraryGame.countDocuments({ userId: uid }),
    Collection.find({ userId: uid }).sort({ createdAt: -1 }).select("name").lean(),
  ]);
  return {
    games: games.map((g: any) => ({ title: g.title, status: g.progressStatus || "none" })),
    totalGames,
    collections: collections.map((c: any) => c.name),
  };
}
