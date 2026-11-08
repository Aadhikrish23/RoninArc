import { Types } from "mongoose";
import libraryServices from "../library/libraryServices";
import PlaySession from "../playSession/PlaySessionModel";
import igdbService from "../igdb/igdbService";
import RecommendationFeedback, { clearNotInterested, markNotInterested, type GameDbIds } from "./RecommendationFeedback";
import {
  DiscoverCandidate,
  LibrarySignalGame,
  Recommendation,
  buildTasteProfile,
  favouriteGenres,
  focusGenres,
  diversifyReasons,
  rankBacklog,
  rankDiscover,
  type LengthPreference,
} from "./recommendationEngine";
import { KNOWN_GENRES } from "../igdb/igdbStyles";
import { closestTitle, fullyNamedTitles } from "../ai/domains/games/conversation/TargetGrounding";
import { expandAbbreviation } from "../igdb/gameAbbreviations";
import { rankByTitle } from "../igdb/titleMatch";
import { playtimeFor } from "../igdb/knownLengths";

export type RecommendationType = "all" | "backlog" | "discover";

/** Genre words a hint can name ("a good platformer"), beyond the genres in the library. */
const FOCUS_GENRES = [...KNOWN_GENRES, "Casual", "Board Games", "Educational"];

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

/** Play styles players ask for (see igdb/igdbStyles.ts for how each is found). */
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

/** Genres and styles of games built for short sessions (a run, a level, a match). */
const SESSION_GENRES = /\b(platformer|arcade|puzzle|fighting|racing|card|sports|casual)\b/i;
const SESSION_TAGS = new Set(["roguelike", "roguelite", "rogue-lite", "arcade", "short", "platformer", "puzzle", "card-game", "deckbuilding"]);

/** "what should I play tonight", "only got an hour", "30 mins": a session, so in-progress games lead. */
const SESSION = /\b(tonight|today|right now|rn|this evening|an hour|one hour|half an hour|\d+\s*(min|mins|minutes|h|hr|hrs|hours?))\b/;

/** Styles that library genres can stand in for. */
const STYLE_GENRES: Record<string, string[]> = { cozy: ["Simulation", "Casual", "Family"] };

const hasStyle = (tags: string[], style: string) => tags.includes(style);

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
    igdbId: g.igdbId,
    tags: g.tags || [],
    styles: g.styleTags || [],
    progressStatus: g.progressStatus || "none",
    rating: g.rating ?? null,
    playMinutes: minutesByGame.get(String(g._id)) || 0,
    communityRating: g.communityRating,
    criticScore: g.criticScore,
    imageURL: g.imageURL || g.artwork?.sources?.[g.artwork?.selectedSource] || undefined,
    avgHours: playtimeFor(g.title, typeof g.playtime === "number" ? g.playtime : undefined),
  }));
}

/** "something like hades but shorter" -> "hades": the game a hint compares to. */
const LIKE_NAME = /\b(?:like|similar to|games? like)\s+([a-z0-9][a-z0-9 :'&.-]{1,40}?)(?=\s+(?:but|and|that|which|with|for|except|only|though|tho)\b|[,.?!]|$)/i;

/** The game a hint compares to, unless it's a stand-in word ("like this"). */
function likeName(query?: string): string | undefined {
  const name = query?.match(LIKE_NAME)?.[1]?.trim();
  return !name || /^(this|that|it|these|those|them|me|my|something|anything)$/i.test(name) ? undefined : name;
}

/**
 * The library game a hint is about. On a big library a loose match lands on the wrong game ("like
 * hades but shorter" was Fallout Shelter, "story rich" was Garden Story), so the name has to fit.
 */
function namedLibraryGame(query: string, library: LibrarySignalGame[]): LibrarySignalGame | undefined {
  const titles = library.map((g) => g.title);
  const name = likeName(query);
  const title = (name && closestTitle(name, titles)) ?? fullyNamedTitles(query, titles)[0];
  return title ? library.find((g) => g.title === title) : undefined;
}

/** The game named after "like", looked up in the game database when it isn't in the library. */
async function likeGameOutsideLibrary(query?: string): Promise<{ title: string; igdbId: number; genres: string[]; avgHours?: number } | undefined> {
  const name = likeName(query);
  if (!name) return undefined;
  try {
    const term = expandAbbreviation(name) ?? name;
    const [best] = rankByTitle(term, await igdbService.searchGames(term, 1));
    if (!best || best.score < 80) return undefined;
    const game = best.item as any;
    // Searching doesn't fetch lengths, and "like hades but shorter" needs this one.
    const { playtime } = await igdbService.getGameFacts(game.id);
    return { title: game.name, igdbId: game.id, genres: game.genres ?? [], avgHours: playtime || undefined };
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
  const focus = focusGenres(options.query, library, Array.from(new Set([...FOCUS_GENRES, ...libraryTags])));
  let length = lengthPreference(options.query);
  const styles = styleTags(options.query);
  // "like Hades": the library game the hint names, to rank and explain by.
  const likeGame = options.query ? namedLibraryGame(options.query, library) : undefined;
  // "like Hades" when Hades isn't in the library: look it up, so its genres and style still count.
  const outside = likeGame ? undefined : await likeGameOutsideLibrary(options.query);
  const likeTitle = likeGame?.title ?? outside?.title;
  const like = likeGame ? { title: likeGame.title, tags: likeGame.tags } : outside ? { title: outside.title, tags: outside.genres } : undefined;
  // "like Celeste but shorter": shorter than Celeste itself, not just "a short game" (Hollow Knight
  // passed as short once and came back as "shorter than Celeste").
  const likeHours = like ? playtimeFor(like.title, likeGame?.avgHours ?? outside?.avgHours) : undefined;
  // The AI passes its own summary ("short games like celeste"), so any "short" with a named game counts.
  if (length === "short" && likeHours && likeHours >= 3) {
    length = { maxHours: Math.max(3, Math.min(20, likeHours - 1)) };
  }
  // "like Hades" also means "plays like Hades": borrow its play style (roguelike).
  const likeIgdbId = likeGame?.igdbId ?? outside?.igdbId;
  let discoverStyles = styles;
  if (styles.slugs.length === 0 && (likeGame || likeIgdbId)) {
    const tags = likeGame ? likeGame.styles : await igdbService.getGameTagSlugs(likeIgdbId as number);
    const style = STYLE_TAGS.find(([, slug]) => DISTINCTIVE_STYLES.has(slug) && tags.includes(slug));
    if (style) discoverStyles = { slugs: [style[1]], label: `${style[2]}, like ${likeTitle}` };
  }
  // No ask at all: discover in the style of the user's favourite (Hollow Knight -> metroidvanias),
  // not just the most popular games in a broad genre like Action.
  if (discoverStyles.slugs.length === 0 && focus.length === 0 && !like) {
    const favourite = library
      .filter((g) => typeof g.rating === "number" && g.rating >= 8)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];
    if (favourite) {
      const style = STYLE_TAGS.find(([, slug]) => DISTINCTIVE_STYLES.has(slug) && favourite.styles.includes(slug));
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
    // "like hades": backlog picks have to play like it (a roguelite), not just share "Action".
    const likeStyle = like && styles.slugs.length === 0 ? discoverStyles.slugs.find((s) => DISTINCTIVE_STYLES.has(s)) : undefined;
    if (likeStyle) {
      backlogPool = backlogPool.filter((g) => hasStyle(g.styles, likeStyle));
    }
    if (shortSession) {
      // Drop only games known to be long; unknown lengths (new adds) stay, so Hades and Celeste still show.
      // A tight time box ("1-2 hrs max", "half an hour") rules out a 50-hour open world even when
      // it's in progress: three playtesters in a row got RDR2 and The Witcher 3 for "2 hours".
      const tight = /\b[1-3](?:\s*(?:-|to)\s*[1-3])?\s*(h|hr|hrs|hours?)\b|\b(an|one|half an?) hour\b|\b\d{1,2}\s*(min|mins|minutes)\b/.test(q);
      const shortEnough = backlogPool.filter((g) => (g.avgHours ?? 0) <= 25);
      let pool = shortEnough;
      if (tight && shortEnough.length > 0) {
        // Games you can drop into for an hour or two (runs, levels, matches) beat a story you'd
        // have to commit to: "2 hrs before bed" got GTA V and Disco Elysium, and missed Hades.
        const sessiony = shortEnough.filter((g) => SESSION_GENRES.test((g.tags ?? []).join(",")) || g.styles.some((t) => SESSION_TAGS.has(t)));
        if (sessiony.length >= 2) pool = sessiony;
      }
      backlogPool = tight && pool.length > 0 ? pool : backlogPool.filter((g) => g.progressStatus === "playing" || (g.avgHours ?? 0) <= 25);
    }
    if (styles.slugs.length === 0) {
      result.backlog = rankBacklog(backlogPool, profile, { limit: options.limit, focus, length: backlogLength, like, session });
    } else {
      // "cozy co-op": the user's own games' styles say how they play; genres stand in when styles are missing.
      const tagged = backlogPool.map((g) => ({ game: g, tags: g.styles }));
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
    try {
      const genres = discoverStyles.slugs.length > 0 ? [] : seedGenres;
      const [found, similar, dismissed] = await Promise.all([
        // One retry: the database is sometimes slow or briefly unavailable.
        igdbService.discover(genres, 40, discoverStyles.slugs).catch(() => igdbService.discover(genres, 40, discoverStyles.slugs)),
        // "like Hades": the database's own list of games like it comes first.
        like && likeIgdbId ? igdbService.similarGames(likeIgdbId).catch(() => []) : Promise.resolve([]),
        RecommendationFeedback.find({ userId }).select("igdbId title").lean(),
      ]);
      const candidates: DiscoverCandidate[] = [...similar.map((game) => ({ ...game, similar: true })), ...found];
      // A filter on "cozy" or "co-op" finds games with either: keep the ones with every style
      // asked for, as long as there are enough of them.
      const wanted = discoverStyles.slugs;
      const withAll = wanted.length > 1 ? candidates.filter((c: any) => wanted.every((s) => (c.tags ?? []).includes(s))) : candidates;
      const pool = withAll.length >= Math.min(3, options.limit) ? withAll : candidates;
      // Dismissed before IGDB (no igdbId): the title is all that's left to go on.
      const dismissedTitles = new Set(dismissed.filter((d: any) => !d.igdbId && d.title).map((d: any) => String(d.title).toLowerCase()));
      result.discover = rankDiscover(pool.filter((c) => !dismissedTitles.has(c.name.toLowerCase())), library, profile, {
        limit: options.limit,
        // The game it's "like" isn't a suggestion for itself.
        dismissed: new Set([...dismissed.map((d: any) => d.igdbId), ...(outside ? [outside.igdbId] : [])]),
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
      // Discovery needs the game database; backlog picks are computed locally and still work offline.
      result.discoverError = "Couldn't reach the game database right now, so only picks from your own library are shown.";
    }
  }

  // One cap across both lists: "Matches your taste for Indie" was on Play Next and twice in Discover.
  const all = diversifyReasons([...result.backlog, ...result.discover]);
  result.backlog = all.slice(0, result.backlog.length);
  result.discover = all.slice(result.backlog.length);
  return result;
}

const dismiss = (userId: string, ids: GameDbIds, title = "") => markNotInterested(userId, ids, title);

const undoDismiss = (userId: string, ids: GameDbIds) => clearNotInterested(userId, ids);

export default { getRecommendations, dismiss, undoDismiss };
