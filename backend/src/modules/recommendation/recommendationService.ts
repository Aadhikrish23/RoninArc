import { Types } from "mongoose";
import libraryServices from "../library/libraryServices";
import PlaySession from "../playSession/PlaySessionModel";
import rawgService from "../rawg/rawgService";
import RecommendationFeedback from "./RecommendationFeedback";
import {
  LibrarySignalGame,
  Recommendation,
  buildTasteProfile,
  favouriteGenres,
  focusGenres,
  rankBacklog,
  rankDiscover,
  type LengthPreference,
} from "./recommendationEngine";
import { mentions } from "../ai/conversation/TargetGrounding";

export type RecommendationType = "all" | "backlog" | "discover";

// RAWG genre names as they appear in library tags, mapped to RAWG's slugs.
const RAWG_GENRE_SLUGS: Record<string, string> = {
  action: "action",
  indie: "indie",
  adventure: "adventure",
  rpg: "role-playing-games-rpg",
  strategy: "strategy",
  shooter: "shooter",
  casual: "casual",
  simulation: "simulation",
  puzzle: "puzzle",
  arcade: "arcade",
  platformer: "platformer",
  "massively multiplayer": "massively-multiplayer",
  racing: "racing",
  sports: "sports",
  fighting: "fighting",
  family: "family",
  "board games": "board-games",
  educational: "educational",
  card: "card",
};
const KNOWN_GENRES = [
  "Action", "Indie", "Adventure", "RPG", "Strategy", "Shooter", "Casual", "Simulation", "Puzzle",
  "Arcade", "Platformer", "Massively Multiplayer", "Racing", "Sports", "Fighting", "Family",
  "Board Games", "Educational", "Card",
];

const toSlug = (genre: string) => RAWG_GENRE_SLUGS[genre.trim().toLowerCase()];

export interface RecommendationResult {
  profile: {
    personalized: boolean;
    signalCount: number;
    topGenres: { genre: string; affinity: number }[];
  };
  focus: string[];
  backlog: Recommendation[];
  discover: Recommendation[];
  discoverError?: string;
}

/** "something short", "a quick one" -> short; "a long rpg" -> long. */
function lengthPreference(query?: string): LengthPreference | undefined {
  const q = (query || "").toLowerCase();
  if (/\b(short|shorter|quick|bite[- ]?sized|small|brief)\b/.test(q)) return "short";
  if (/\b(long|longer|lengthy|epic|huge|big)\b/.test(q)) return "long";
  return undefined;
}

async function loadSignals(userId: string): Promise<LibrarySignalGame[]> {
  const [library, minutes] = await Promise.all([
    libraryServices.getUserLibrary(userId),
    PlaySession.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: "$gameId", minutes: { $sum: "$durationMinutes" } } },
    ]),
  ]);
  const minutesByGame = new Map(minutes.map((m: any) => [String(m._id), m.minutes || 0]));

  return library.map((g: any) => ({
    _id: String(g._id),
    title: g.title,
    rawgId: g.rawgId,
    tags: g.tags || [],
    progressStatus: g.progressStatus || "none",
    rating: g.rating ?? null,
    playMinutes: minutesByGame.get(String(g._id)) || 0,
    rawgRating: g.rawgRating,
    metacritic: g.metacritic,
    imageURL: g.imageURL || g.artwork?.sources?.[g.artwork?.selectedSource] || undefined,
    avgHours: typeof g.playtime === "number" ? g.playtime : undefined,
  }));
}

async function getRecommendations(
  userId: string,
  options: { type: RecommendationType; limit: number; query?: string },
): Promise<RecommendationResult> {
  const library = await loadSignals(userId);
  const profile = buildTasteProfile(library);
  const libraryTags = Array.from(new Set(library.flatMap((g) => g.tags)));
  const focus = focusGenres(options.query, library, Array.from(new Set([...KNOWN_GENRES, ...libraryTags])));
  const length = lengthPreference(options.query);
  // "like Hades": the library game the hint names, to rank and explain by.
  const likeGame = options.query
    ? library
        .filter((g) => mentions(options.query!, g.title))
        .sort((a, b) => b.title.length - a.title.length)[0]
    : undefined;
  const like = likeGame ? { title: likeGame.title, tags: likeGame.tags } : undefined;

  const result: RecommendationResult = {
    profile: {
      personalized: profile.signalCount > 0,
      signalCount: profile.signalCount,
      topGenres: profile.genres.filter((g) => g.affinity > 0).slice(0, 5),
    },
    focus,
    backlog: [],
    discover: [],
  };

  if (options.type !== "discover") {
    result.backlog = rankBacklog(library, profile, { limit: options.limit, focus, length, like });
  }

  if (options.type !== "backlog") {
    const seedGenres = focus.length > 0 ? focus : favouriteGenres(profile, 3);
    const slugs = seedGenres.map(toSlug).filter((s): s is string => !!s);
    try {
      const [candidates, dismissed] = await Promise.all([
        rawgService.discoverByGenres(slugs, 40),
        RecommendationFeedback.find({ userId }).select("rawgId").lean(),
      ]);
      result.discover = rankDiscover(candidates, library, profile, {
        limit: options.limit,
        dismissed: new Set(dismissed.map((d: any) => d.rawgId)),
        focus,
        length,
        like,
      });
    } catch {
      // Discovery needs RAWG; backlog picks are computed locally and still work offline.
      result.discoverError = "Couldn't reach the game database right now, so only picks from your own library are shown.";
    }
  }

  return result;
}

async function dismiss(userId: string, rawgId: number, title = "") {
  await RecommendationFeedback.updateOne(
    { userId, rawgId },
    { $setOnInsert: { userId, rawgId }, $set: { title } },
    { upsert: true },
  );
}

async function undoDismiss(userId: string, rawgId: number) {
  const res = await RecommendationFeedback.deleteOne({ userId, rawgId });
  return res.deletedCount > 0;
}

export default { getRecommendations, dismiss, undoDismiss };
