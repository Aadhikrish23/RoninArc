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
import { expandAbbreviation } from "../rawg/gameAbbreviations";
import { rankByTitle } from "../rawg/titleMatch";

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

const toSlug = (genre: string) => {
  const key = genre.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(RAWG_GENRE_SLUGS, key) ? RAWG_GENRE_SLUGS[key] : undefined;
};

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

/** Play styles players ask for, as RAWG tag slugs (verified against RAWG's /tags). */
const STYLE_TAGS: [RegExp, string, string][] = [
  [/\brogue-?lites?\b/, "roguelite", "Roguelite"],
  [/\brogue-?likes?\b/, "roguelike", "Roguelike"],
  [/\bsouls-?(like|likes|borne)\b/, "souls-like", "Souls-like"],
  [/\bmetroidvanias?\b/, "metroidvania", "Metroidvania"],
  [/\bopen[- ]world\b/, "open-world", "Open world"],
  [/\b(cozy|cosy|chill|relaxing|comfy)\b/, "cozy", "Cozy"],
  [/\bfarm(ing)?\b/, "farming", "Farming"],
  [/\bstory[- ]rich|\bstory driven|\bnarrative\b/, "story-rich", "Story rich"],
  [/\bco-?op\b/, "co-op", "Co-op"],
  [/\bsurvival\b/, "survival", "Survival"],
  [/\bturn[- ]based\b/, "turn-based", "Turn-based"],
  [/\bdeck ?build/, "deckbuilding", "Deckbuilder"],
  [/\bjrpgs?\b/, "jrpg", "JRPG"],
  [/\bstealth\b/, "stealth", "Stealth"],
  [/\bhorror\b/, "horror", "Horror"],
];

/** "what should I play tonight", "only got an hour", "30 mins": a session, so in-progress games lead. */
const SESSION = /\b(tonight|today|right now|rn|this evening|an hour|one hour|half an hour|\d+\s*(min|mins|minutes|h|hr|hrs|hours?))\b/;

/** Owned games' RAWG tags, cached for the life of the process (tags rarely change). */
const tagCache = new Map<number, string[]>();
async function tagsFor(rawgId: number): Promise<string[]> {
  if (!tagCache.has(rawgId)) tagCache.set(rawgId, await rawgService.getGameTagSlugs(rawgId));
  return tagCache.get(rawgId)!;
}

/** Styles that library genres can stand in for. */
const STYLE_GENRES: Record<string, string[]> = { cozy: ["Simulation", "Casual", "Family"] };

/** Tags that count as a style on a game the user owns (Stardew is "relaxing" and "farming", not always "cozy"). */
const STYLE_SYNONYMS: Record<string, string[]> = {
  // "cute" and "casual" are too broad: Hollow Knight is tagged cute and came back as "cozy".
  cozy: ["cozy", "relaxing", "farming", "life-sim", "wholesome"],
  "co-op": ["co-op", "online-co-op", "local-co-op", "cooperative", "split-screen"],
  farming: ["farming", "agriculture", "life-sim"],
};
const hasStyle = (tags: string[], style: string) => (STYLE_SYNONYMS[style] ?? [style]).some((t) => tags.includes(t));

/** Play styles specific enough to define "games like X" (open world or co-op alone don't). */
const DISTINCTIVE_STYLES = new Set(["roguelite", "roguelike", "souls-like", "metroidvania", "deckbuilding", "jrpg"]);

function styleTags(query?: string): { slugs: string[]; label?: string } {
  const q = (query || "").toLowerCase();
  const hits = STYLE_TAGS.filter(([re]) => re.test(q));
  return { slugs: hits.map(([, slug]) => slug), label: hits.map(([, , label]) => label).join(", ") || undefined };
}

/** "something short", "under 20 hours" -> length limit; "a long rpg" -> long. */
function lengthPreference(query?: string): LengthPreference | undefined {
  const q = (query || "").toLowerCase();
  const limit = q.match(/\b(under|less than|below|max|at most|<)\s*(\d{1,3})\s*(h|hr|hrs|hours?)\b/);
  if (limit) return { maxHours: Number(limit[2]) };
  // "a roguelike i can finish in like 10-15 hours"
  const range = q.match(/\b(\d{1,3})\s*(?:-|–|to)\s*(\d{1,3})\s*(h|hr|hrs|hours?)\b/);
  if (range) return { maxHours: Math.max(Number(range[1]), Number(range[2])) };
  // "only got like 2 hrs tonight": a short session, so a short game.
  if (/\b(only )?(got|have)( like| about| maybe)? \d\s*(h|hrs?|hours?)\b/.test(q)) return { maxHours: 12 }; // a couple of hours tonight: new picks you could actually get through
  // "only got like an hour", "30 mins", "half an hour": a short session too.
  if (/\b(an|one|half an?) hour\b|\b\d+\s*(min|mins|minutes)\b/.test(q)) return { maxHours: 12 };
  if (/\bi (don'?t|dont) have \d{2,3}\s*(h|hrs?|hours?)\b/.test(q)) return "short";
  // "something I could beat in a weekend" is roughly a 15-hour game.
  if (/\bweekend\b/.test(q)) return { maxHours: 15 };
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

/** "something like hades but shorter" -> "hades": the game a hint compares to. */
const LIKE_NAME = /\b(?:like|similar to|games? like)\s+([a-z0-9][a-z0-9 :'&.-]{1,40}?)(?=\s+(?:but|and|that|which|with|for|except|only|though|tho)\b|[,.?!]|$)/i;

/** The game named after "like", looked up on RAWG when it isn't in the library. */
async function likeGameOutsideLibrary(query?: string): Promise<{ title: string; rawgId: number; genres: string[] } | undefined> {
  const name = query?.match(LIKE_NAME)?.[1]?.trim();
  if (!name || /^(this|that|it|these|those|them|me|my|something|anything)$/i.test(name)) return undefined;
  try {
    const term = expandAbbreviation(name) ?? name;
    const [best] = rankByTitle(term, await rawgService.searchGames(term, 1));
    if (!best || best.score < 80) return undefined;
    const game = best.item as any;
    return { title: game.name, rawgId: game.id, genres: game.genres ?? [] };
  } catch {
    return undefined; // a hint, not a requirement
  }
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
  const styles = styleTags(options.query);
  // "like Hades": the library game the hint names, to rank and explain by.
  const likeGame = options.query
    ? library
        .filter((g) => mentions(options.query!, g.title))
        .sort((a, b) => b.title.length - a.title.length)[0]
    : undefined;
  // "like Hades" when Hades isn't in the library: look it up, so its genres and style still count.
  const outside = likeGame ? undefined : await likeGameOutsideLibrary(options.query);
  const likeTitle = likeGame?.title ?? outside?.title;
  const likeRawgId = likeGame?.rawgId ?? outside?.rawgId;
  const like = likeGame ? { title: likeGame.title, tags: likeGame.tags } : outside ? { title: outside.title, tags: outside.genres } : undefined;
  // "like Hades" also means "plays like Hades": borrow its play style (roguelike) from RAWG.
  let discoverStyles = styles;
  if (styles.slugs.length === 0 && likeRawgId) {
    const tags = await rawgService.getGameTagSlugs(likeRawgId);
    const style = STYLE_TAGS.find(([, slug]) => DISTINCTIVE_STYLES.has(slug) && tags.includes(slug));
    if (style) discoverStyles = { slugs: [style[1]], label: `${style[2]}, like ${likeTitle}` };
  }
  // No ask at all: discover in the style of the user's favourite (Hollow Knight -> metroidvanias),
  // not just the most popular games in a broad genre like Action.
  if (discoverStyles.slugs.length === 0 && focus.length === 0 && !like) {
    const favourite = library
      .filter((g) => typeof g.rating === "number" && g.rating >= 8 && g.rawgId)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    if (favourite?.rawgId) {
      const tags = await rawgService.getGameTagSlugs(favourite.rawgId);
      const style = STYLE_TAGS.find(([, slug]) => DISTINCTIVE_STYLES.has(slug) && tags.includes(slug));
      if (style) discoverStyles = { slugs: [style[1]], label: `${style[2]}, like ${favourite.title}` };
    }
  }

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
    // A play style ("roguelike") can't be checked against library games (they only carry
    // genres), and a length limit needs a known playtime: only offer backlog picks we can vouch for.
    // "only got 2 hrs tonight" limits the session, not the game: any backlog game can fill it.
    // "what should I play tonight": what you're already into comes first.
    const q = (options.query || "").toLowerCase();
    const session = SESSION.test(q);
    // A short session ("only got an hour") fits a game you're in the middle of, or a short one --
    // not a 60-hour open world you haven't started.
    const shortSession = session && length !== undefined && length !== "long";
    const backlogLength = shortSession ? undefined : length;
    let backlogPool = backlogLength ? library.filter((g) => (g.avgHours ?? 0) >= 3) : library;
    if (shortSession) {
      // Drop only games known to be long; unknown lengths (new adds) stay, so Hades and Celeste still show.
      // A tight time box ("1-2 hrs max", "half an hour") rules out a 50-hour open world even when
      // it's in progress: three playtesters in a row got RDR2 and The Witcher 3 for "2 hours".
      const tight = /\b[1-3](?:\s*(?:-|to)\s*[1-3])?\s*(h|hr|hrs|hours?)\b|\b(an|one|half an?) hour\b|\b\d{1,2}\s*(min|mins|minutes)\b/.test(q);
      const shortEnough = backlogPool.filter((g) => (g.avgHours ?? 0) <= 25);
      backlogPool = tight && shortEnough.length > 0 ? shortEnough : backlogPool.filter((g) => g.progressStatus === "playing" || (g.avgHours ?? 0) <= 25);
    }
    if (styles.slugs.length === 0) {
      result.backlog = rankBacklog(backlogPool, profile, { limit: options.limit, focus, length: backlogLength, like, session });
    } else {
      // "cozy co-op": the user's own games' RAWG tags say how they play; genres stand in when tags are missing.
      const tagged = await Promise.all(
        backlogPool.map(async (g) => ({ game: g, tags: g.rawgId ? await tagsFor(g.rawgId) : [] })),
      );
      // Games with every style asked for come first ("cozy co-op" is Stardew, not RDR2's online mode).
      const matched = (tags: string[]) => styles.slugs.filter((s) => hasStyle(tags, s)).length;
      const best = Math.max(0, ...tagged.map((t) => matched(t.tags)));
      const styled = best > 0 ? tagged.filter((t) => matched(t.tags) === best).map((t) => t.game) : [];
      const styleGenres = styles.slugs.flatMap((s) => STYLE_GENRES[s] ?? []);
      result.backlog =
        styled.length > 0
          ? rankBacklog(styled, profile, { limit: options.limit, focus, length: backlogLength, like, session })
          : styleGenres.length > 0
            ? rankBacklog(backlogPool, profile, { limit: options.limit, focus: [...focus, ...styleGenres], length: backlogLength, like, session })
            : [];
    }
  }

  if (options.type !== "backlog") {
    const seedGenres = focus.length > 0 ? focus : favouriteGenres(profile, 3);
    const slugs = seedGenres.map(toSlug).filter((s): s is string => !!s);
    try {
      const [candidates, dismissed] = await Promise.all([
        // One retry: RAWG is sometimes slow or briefly unavailable.
        rawgService
          .discoverByGenres(discoverStyles.slugs.length > 0 ? [] : slugs, 40, discoverStyles.slugs)
          .catch(() => rawgService.discoverByGenres(discoverStyles.slugs.length > 0 ? [] : slugs, 40, discoverStyles.slugs)),
        RecommendationFeedback.find({ userId }).select("rawgId").lean(),
      ]);
      // RAWG treats "cozy,co-op" as either tag (GTA V and Dota 2 came back as "cozy co-op"):
      // keep the games that have every style asked for, as long as there are enough of them.
      const wanted = discoverStyles.slugs;
      const withAll = wanted.length > 1 ? candidates.filter((c: any) => wanted.every((s) => (c.tags ?? []).includes(s))) : candidates;
      const pool = withAll.length >= Math.min(3, options.limit) ? withAll : candidates;
      result.discover = rankDiscover(pool, library, profile, {
        limit: options.limit,
        // The game it's "like" isn't a suggestion for itself.
        dismissed: new Set([...dismissed.map((d: any) => d.rawgId), ...(outside ? [outside.rawgId] : [])]),
        focus: discoverStyles.slugs.length > 0 ? [] : focus,
        length,
        like,
        tagLabel: discoverStyles.label,
        // "Cozy, Co-op" only on games that are: Half-Life 2: Deathmatch isn't cozy.
        tagLabelFor: (c) => {
          const has = STYLE_TAGS.filter(([, slug]) => discoverStyles.slugs.includes(slug) && hasStyle(c.tags ?? [], slug)).map(([, , label]) => label);
          if (has.length === 0) return undefined;
          const like = discoverStyles.label?.match(/, like .+$/)?.[0] ?? "";
          return `${has.join(", ")}${like}`;
        },
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
