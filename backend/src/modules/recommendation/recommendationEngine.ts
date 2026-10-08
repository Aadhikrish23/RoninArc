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
}

export interface DiscoverCandidate {
  id: number;
  name: string;
  imageURL?: string;
  rating?: number;
  released?: string;
  genres: string[];
  metacritic?: number | null;
}

export interface GenreAffinity {
  genre: string;
  affinity: number; // -1 (dislikes) .. 1 (loves)
}

export interface TasteProfile {
  genres: GenreAffinity[];
  signalCount: number;
  anchors: Record<string, { title: string; why: string }>;
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

const BACKLOG_STATUSES: ProgressStatus[] = ["plan", "none", "paused"];

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

function anchorReason(game: LibrarySignalGame): string {
  if (game.rating !== null && game.rating !== undefined) return `you rated ${game.title} ${game.rating}/10`;
  if (game.progressStatus === "completed") return `you finished ${game.title}`;
  if (game.progressStatus === "playing") return `you're playing ${game.title}`;
  const hours = Math.round((game.playMinutes / 60) * 10) / 10;
  return `you've played ${game.title} for ${hours}h`;
}

export function buildTasteProfile(library: LibrarySignalGame[]): TasteProfile {
  const totals = new Map<string, { label: string; sum: number }>();
  const best = new Map<string, { weight: number; game: LibrarySignalGame }>();
  let signalCount = 0;

  for (const game of library) {
    if (!isSignal(game)) continue;
    signalCount += 1;
    const weight = gameWeight(game);
    for (const tag of game.tags || []) {
      const key = norm(tag);
      const entry = totals.get(key) ?? { label: tag, sum: 0 };
      entry.sum += weight;
      totals.set(key, entry);
      const current = best.get(key);
      if (weight > 0 && (!current || weight > current.weight)) best.set(key, { weight, game });
    }
  }

  const maxAbs = Math.max(0, ...Array.from(totals.values()).map((t) => Math.abs(t.sum)));
  const genres: GenreAffinity[] = Array.from(totals.values())
    .map((t) => ({ genre: t.label, affinity: maxAbs > 0 ? Math.round((t.sum / maxAbs) * 100) / 100 : 0 }))
    .sort((a, b) => b.affinity - a.affinity || a.genre.localeCompare(b.genre));

  const anchors: TasteProfile["anchors"] = {};
  for (const [key, { game }] of best) {
    anchors[key] = { title: game.title, why: anchorReason(game) };
  }

  return { genres, signalCount, anchors };
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

function tasteReason(genre: string | undefined, profile: TasteProfile): string | null {
  if (!genre) return null;
  const anchor = profile.anchors[norm(genre)];
  return anchor ? `${genre}, like ${anchor.title} -- ${anchor.why}` : `Matches your taste for ${genre}`;
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
  options: { limit: number; focus?: string[] },
): Recommendation[] {
  const personalized = profile.signalCount > 0;
  const focus = options.focus ?? [];

  return library
    .filter((g) => BACKLOG_STATUSES.includes(g.progressStatus) && overlapsFocus(g.tags || [], focus))
    .map((game) => {
      const match = tasteMatch(game.tags || [], profile);
      const boost = game.progressStatus === "paused" ? 0.1 : game.progressStatus === "plan" ? 0.05 : 0;
      const reasons = [
        tasteReason(match.top, profile),
        game.progressStatus === "paused" ? "You paused it -- a good time to pick it back up" : null,
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
  options: { limit: number; dismissed: Set<number>; focus?: string[] },
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
        overlapsFocus(c.genres, focus)
      );
    })
    .map((c) => {
      const match = tasteMatch(c.genres, profile);
      const reasons = [tasteReason(match.top, profile), qualityReason(c.rating, c.metacritic)].filter(
        (r): r is string => !!r,
      );
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
