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

/** "short" keeps games under ~20h, "long" keeps games over ~25h (games with unknown length stay). */
export type LengthPreference = "short" | "long";

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
function tasteReason(genres: string[], top: string | undefined, profile: TasteProfile, selfTitle: string): string | null {
  const own = new Set(genres.map(norm));
  let best: TasteProfile["liked"][number] | undefined;
  let bestShared = 0;
  for (const game of profile.liked) {
    if (norm(game.title) === norm(selfTitle)) continue;
    const shared = game.tags.filter((t) => own.has(norm(t))).length;
    if (shared > bestShared) {
      best = game;
      bestShared = shared;
    }
  }
  if (best) return `Similar to ${best.title}, which ${best.why}`;
  return top ? `Matches your taste for ${top}` : null;
}

function lengthReason(hours?: number): string | null {
  if (!hours || hours <= 0) return null;
  return hours <= 15 ? `Short: about ${hours}h to play` : null;
}

function fitsLength(hours: number | undefined, length?: LengthPreference): boolean {
  if (!length || !hours || hours <= 0) return true;
  return length === "short" ? hours <= 20 : hours >= 25;
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
  options: { limit: number; focus?: string[]; length?: LengthPreference },
): Recommendation[] {
  const personalized = profile.signalCount > 0;
  const focus = options.focus ?? [];

  return library
    .filter(
      (g) =>
        BACKLOG_STATUSES.includes(g.progressStatus) &&
        overlapsFocus(g.tags || [], focus) &&
        fitsLength(g.avgHours, options.length),
    )
    .map((game) => {
      const match = tasteMatch(game.tags || [], profile);
      const boost =
        game.progressStatus === "playing" ? 0.15 : game.progressStatus === "paused" ? 0.1 : game.progressStatus === "plan" ? 0.05 : 0;
      const reasons = [
        game.progressStatus === "playing" ? "You're in the middle of it" : null,
        game.progressStatus === "paused" ? "You paused it. A good time to pick it back up" : null,
        tasteReason(game.tags || [], match.top, profile, game.title),
        options.length === "short" ? lengthReason(game.avgHours) : null,
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
  options: { limit: number; dismissed: Set<number>; focus?: string[]; length?: LengthPreference },
): Recommendation[] {
  const personalized = profile.signalCount > 0;
  const ownedIds = new Set(library.map((g) => g.rawgId).filter((id): id is number => typeof id === "number"));
  const ownedTitles = new Set(library.map((g) => norm(g.title)));
  const focus = options.focus ?? [];
  const seen = new Set<number>();

  return candidates
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return (
        !ownedIds.has(c.id) &&
        !ownedTitles.has(norm(c.name)) &&
        !options.dismissed.has(c.id) &&
        overlapsFocus(c.genres, focus) &&
        fitsLength(c.avgHours, options.length)
      );
    })
    .map((c) => {
      const match = tasteMatch(c.genres, profile);
      const reasons = [
        tasteReason(c.genres, match.top, profile, c.name),
        options.length === "short" ? lengthReason(c.avgHours) : null,
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
        score: finalScore(match.score, quality(c.rating, c.metacritic), 0, personalized),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, options.limit);
}
