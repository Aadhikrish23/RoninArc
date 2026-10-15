// Pure scoring logic for recommendations -- no database or network access, so
// the same inputs always produce the same ranking (and it works offline).

export type ProgressStatus = "none" | "plan" | "playing" | "paused" | "completed" | "dropped";

export interface LibrarySignalGame {
  _id: string;
  title: string;
  rawgId?: number;
  tags: string[];
  progressStatus: ProgressStatus;
  rating: number | null;
  playMinutes: number;
  rawgRating?: number;
  metacritic?: number | null;
  imageURL?: string;
  /** RAWG's average hours to play, when known. */
  avgHours?: number;
}

export interface DiscoverCandidate {
  id: number;
  name: string;
  imageURL?: string;
  rating?: number;
  released?: string;
  genres: string[];
  metacritic?: number | null;
  avgHours?: number;
}

/** "short" keeps games under ~20h (or the user's own limit), "long" keeps games over ~25h; unknown lengths stay. */
export type LengthPreference = "short" | "long" | { maxHours: number };

export interface GenreAffinity {
  genre: string;
  affinity: number; // -1 (dislikes) .. 1 (loves)
}

export interface TasteProfile {
  genres: GenreAffinity[];
  signalCount: number;
  /** Games the user likes, used to explain a pick by its closest match ("Similar to X, which you rated 9/10"). */
  liked: { title: string; tags: string[]; weight: number; why: string }[];
}

export interface Recommendation {
  source: "library" | "rawg";
  gameId?: string;
  rawgId?: number;
  title: string;
  imageURL?: string;
  genres: string[];
  status?: ProgressStatus;
  released?: string;
  score: number; // 0..100
  reasons: string[];
}

const STATUS_WEIGHT: Record<ProgressStatus, number> = {
  completed: 0.5,
  playing: 0.4,
  paused: 0,
  plan: 0,
  none: 0,
  dropped: -0.7,
};

const BACKLOG_STATUSES: ProgressStatus[] = ["playing", "paused", "plan", "none"];

const norm = (s: string) => s.trim().toLowerCase();

/** How strongly a single game says something about the user's taste. */
function gameWeight(game: LibrarySignalGame): number {
  let weight = STATUS_WEIGHT[game.progressStatus] ?? 0;
  if (game.rating !== null && game.rating !== undefined) {
    weight += (game.rating - 5.5) / 4.5;
  }
  if (game.playMinutes > 0) {
    weight += Math.min(0.5, Math.log10(1 + game.playMinutes / 30) * 0.35);
  }
  return weight;
}

function isSignal(game: LibrarySignalGame): boolean {
  return (
    (game.rating !== null && game.rating !== undefined) ||
    ["completed", "playing", "dropped"].includes(game.progressStatus) ||
    game.playMinutes > 0
  );
}

/** Completes "Similar to X, which …". */
function anchorReason(game: LibrarySignalGame): string {
  if (game.rating !== null && game.rating !== undefined) return `you rated ${game.rating}/10`;
  if (game.progressStatus === "completed") return "you finished";
  if (game.progressStatus === "playing") return "you're playing";
  const hours = Math.round((game.playMinutes / 60) * 10) / 10;
  return `you've played for ${hours}h`;
}

export function buildTasteProfile(library: LibrarySignalGame[]): TasteProfile {
  const totals = new Map<string, { label: string; sum: number }>();
  const liked: TasteProfile["liked"] = [];
  let signalCount = 0;

  for (const game of library) {
    if (!isSignal(game)) continue;
    signalCount += 1;
    const weight = gameWeight(game);
    if (weight > 0) liked.push({ title: game.title, tags: game.tags || [], weight, why: anchorReason(game) });
    for (const tag of game.tags || []) {
      const key = norm(tag);
      const entry = totals.get(key) ?? { label: tag, sum: 0 };
      entry.sum += weight;
      totals.set(key, entry);
    }
  }

  const maxAbs = Math.max(0, ...Array.from(totals.values()).map((t) => Math.abs(t.sum)));
  const genres: GenreAffinity[] = Array.from(totals.values())
    .map((t) => ({ genre: t.label, affinity: maxAbs > 0 ? Math.round((t.sum / maxAbs) * 100) / 100 : 0 }))
    .sort((a, b) => b.affinity - a.affinity || a.genre.localeCompare(b.genre));

  liked.sort((a, b) => b.weight - a.weight);
  return { genres, signalCount, liked };
}

/** Genres the user clearly likes, strongest first. */
export function favouriteGenres(profile: TasteProfile, max = 3): string[] {
  return profile.genres.filter((g) => g.affinity > 0).slice(0, max).map((g) => g.genre);
}

/**
 * Turns a free-text hint ("something like Hades", "a platformer") into genres
 * to focus on: a library title contributes its tags, a genre name itself.
 */
export function focusGenres(query: string | undefined, library: LibrarySignalGame[], knownGenres: string[]): string[] {
  const q = norm(query || "");
  if (!q) return [];

  const focus = new Map<string, string>();
  for (const game of library) {
    if (game.title && q.includes(norm(game.title))) {
      for (const tag of game.tags || []) focus.set(norm(tag), tag);
    }
  }
  for (const genre of knownGenres) {
    const g = norm(genre);
    // "platformer" matches "platformers", "rpg" matches "rpgs".
    if (new RegExp(`\\b${g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`).test(q)) focus.set(g, genre);
  }
  return Array.from(focus.values());
}

function tasteMatch(genres: string[], profile: TasteProfile): { score: number; top?: string } {
  if (profile.signalCount === 0 || genres.length === 0) return { score: 0.5 };
  const byKey = new Map(profile.genres.map((g) => [norm(g.genre), g.affinity]));
  let sum = 0;
  let top: { genre: string; affinity: number } | undefined;
  for (const genre of genres) {
    const affinity = byKey.get(norm(genre)) ?? 0;
    sum += affinity;
    if (affinity > 0 && (!top || affinity > top.affinity)) top = { genre, affinity };
  }
  return { score: (sum / genres.length + 1) / 2, top: top?.genre };
}

function quality(rating?: number, metacritic?: number | null): number {
  if (metacritic) return metacritic / 100;
  if (rating) return rating / 5;
  return 0.5;
}

function qualityReason(rating?: number, metacritic?: number | null): string | null {
  if (metacritic && metacritic >= 85) return `Critically acclaimed (Metacritic ${metacritic})`;
  if (rating && rating >= 4.2) return `Highly rated by players (${rating.toFixed(1)}/5)`;
  return null;
}

/**
 * Explains a pick by the liked game it has most in common with, so each pick
 * gets its own reason instead of every card citing the same favourite.
 */
function tasteReason(
  genres: string[],
  top: string | undefined,
  profile: TasteProfile,
  selfTitle: string,
  used: Map<string, number> = new Map(),
): string | null {
  const own = new Set(genres.map(norm));
  let best: TasteProfile["liked"][number] | undefined;
  let bestScore = 0;
  for (const game of profile.liked) {
    if (norm(game.title) === norm(selfTitle)) continue;
    const shared = game.tags.filter((t) => own.has(norm(t))).length;
    // One broad genre in common ("Action") doesn't make GTA "similar to Hollow Knight".
    if (shared < 2) continue;
    // Overlap relative to both games' genres, nudged by how much the user likes it,
    // and spread out so one favourite doesn't explain every pick.
    const union = new Set([...own, ...game.tags.map(norm)]).size;
    const score = (shared / union) * (0.6 + Math.min(game.weight, 2) * 0.2) / (1 + (used.get(game.title) ?? 0) * 0.6);
    if (score > bestScore) {
      best = game;
      bestScore = score;
    }
  }
  if (best) {
    used.set(best.title, (used.get(best.title) ?? 0) + 1);
    return `Similar to ${best.title}, which ${best.why}`;
  }
  return top ? `Matches your taste for ${top}` : null;
}

/** "like Hades": rank and explain by the named game. */
export interface LikeGame {
  title: string;
  tags: string[];
}

function likeOverlap(genres: string[], like?: LikeGame): number {
  if (!like || like.tags.length === 0) return 0;
  const own = new Set(genres.map(norm));
  const shared = like.tags.filter((t) => own.has(norm(t))).length;
  return shared / new Set([...own, ...like.tags.map(norm)]).size;
}

function likeReason(genres: string[], like?: LikeGame): string | null {
  if (!like) return null;
  const own = new Set(genres.map(norm));
  const shared = like.tags.filter((t) => own.has(norm(t)));
  return shared.length > 0 ? `Shares ${shared.slice(0, 2).join(" and ")} with ${like.title}` : null;
}

/** RAWG's average playtime is unreliable below a few hours (few players logged it), so treat it as unknown. */
const knownHours = (hours?: number) => (hours && hours >= 3 ? hours : undefined);

function lengthReason(hours?: number): string | null {
  const h = knownHours(hours);
  return h && h <= 15 ? `Shorter: about ${h}h on average` : null;
}

function fitsLength(hours: number | undefined, length?: LengthPreference): boolean {
  const h = knownHours(hours);
  if (!length || !h) return true;
  if (typeof length === "object") return h <= length.maxHours;
  return length === "short" ? h <= 20 : h >= 25;
}

function overlapsFocus(genres: string[], focus: string[]): boolean {
  if (focus.length === 0) return true;
  const wanted = new Set(focus.map(norm));
  return genres.some((g) => wanted.has(norm(g)));
}

function finalScore(taste: number, qual: number, boost: number, personalized: boolean): number {
  const raw = personalized ? 0.65 * taste + 0.3 * qual + boost : 0.85 * qual + boost;
  return Math.max(0, Math.min(100, Math.round(raw * 100)));
}

export function rankBacklog(
  library: LibrarySignalGame[],
  profile: TasteProfile,
  options: { limit: number; focus?: string[]; length?: LengthPreference; like?: LikeGame },
): Recommendation[] {
  const personalized = profile.signalCount > 0;
  const focus = options.focus ?? [];
  const used = new Map<string, number>();

  return library
    .filter((g) => !options.like || norm(g.title) !== norm(options.like.title))
    .filter(
      (g) =>
        BACKLOG_STATUSES.includes(g.progressStatus) &&
        (g.rating === null || g.rating === undefined) &&
        overlapsFocus(g.tags || [], focus) &&
        fitsLength(g.avgHours, options.length),
    )
    .map((game) => {
      const match = tasteMatch(game.tags || [], profile);
      // Paused games get no push: "taking a break" means not right now.
      const boost =
        (game.progressStatus === "playing" ? 0.15 : game.progressStatus === "plan" ? 0.05 : 0) +
        likeOverlap(game.tags || [], options.like) * 0.4;
      const reasons = [
        game.progressStatus === "playing" ? "You're in the middle of it" : null,
        game.progressStatus === "paused" ? "On pause, whenever you want to go back" : null,
        likeReason(game.tags || [], options.like) ?? tasteReason(game.tags || [], match.top, profile, game.title, used),
        options.length ? lengthReason(game.avgHours) : null,
        qualityReason(game.rawgRating, game.metacritic),
      ].filter((r): r is string => !!r);
      if (reasons.length === 0) reasons.push("Waiting in your backlog");

      return {
        source: "library" as const,
        gameId: game._id,
        rawgId: game.rawgId,
        title: game.title,
        imageURL: game.imageURL,
        genres: game.tags || [],
        status: game.progressStatus,
        score: finalScore(match.score, quality(game.rawgRating, game.metacritic), boost, personalized),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, options.limit);
}

export function rankDiscover(
  candidates: DiscoverCandidate[],
  library: LibrarySignalGame[],
  profile: TasteProfile,
  options: { limit: number; dismissed: Set<number>; focus?: string[]; length?: LengthPreference; like?: LikeGame; tagLabel?: string },
): Recommendation[] {
  const used = new Map<string, number>();
  const personalized = profile.signalCount > 0;
  const ownedIds = new Set(library.map((g) => g.rawgId).filter((id): id is number => typeof id === "number"));
  const ownedTitles = new Set(library.map((g) => norm(g.title)));
  const focus = options.focus ?? [];
  const seen = new Set<number>();

  const eligible = candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return (
      !ownedIds.has(c.id) &&
      !ownedTitles.has(norm(c.name)) &&
      !options.dismissed.has(c.id) &&
      overlapsFocus(c.genres, focus) &&
      fitsLength(c.avgHours, options.length)
    );
  });
  // With a length limit, games whose length is known to fit come first; unknown lengths only fill gaps.
  const known = options.length ? eligible.filter((c) => knownHours(c.avgHours)) : eligible;
  const pool = known.length >= options.limit ? known : eligible;

  return pool
    .map((c) => {
      const match = tasteMatch(c.genres, profile);
      const reasons = [
        likeReason(c.genres, options.like) ?? tasteReason(c.genres, match.top, profile, c.name, used),
        options.length ? lengthReason(c.avgHours) : null,
        options.tagLabel ? `${options.tagLabel}` : null,
        qualityReason(c.rating, c.metacritic),
      ].filter((r): r is string => !!r);
      if (reasons.length === 0) reasons.push(personalized ? "Something new to try" : "Popular with players right now");

      return {
        source: "rawg" as const,
        rawgId: c.id,
        title: c.name,
        imageURL: c.imageURL,
        genres: c.genres,
        released: c.released,
        score: finalScore(match.score, quality(c.rating, c.metacritic), likeOverlap(c.genres, options.like) * 0.4, personalized),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, options.limit);
}
