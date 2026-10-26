import axios from "axios";
import AppError from "../../shared/errors/AppError";
import dotenv from "dotenv";
import { playtimeFor } from "./knownLengths";
dotenv.config();

const RAWG_BASE_URL = process.env.RAWG_BASE_URL;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

async function searchGames(query: string, page: number, precise = true) {

  if (!RAWG_BASE_URL || !RAWG_API_KEY) {
    throw new AppError("RAWG API is not configured", 500);
  }

  try {
    const url = `${RAWG_BASE_URL}/games`;
    const request = () =>
      axios.get(url, {
        params: {
          key: RAWG_API_KEY,
          search: query,
          page,

          search_precise: precise,
          // No popularity ordering: with "-added", RAWG puts GTA V first for
          // "rdr 2" and even for "red dead redemption 2". Its default order is relevance.
        },
        timeout: 10000,
      });
    // One retry: RAWG sometimes drops or stalls a request ("stardew" failed every time a
    // playtester typed it, while the same search worked moments later).
    const response = await request().catch(() => request());

    const results = response.data.results;

    const cleaned = results.map((g: any) => ({
      id: g.id,
      name: g.name,
      imageURL: g.background_image,
      rating: g.rating,
      released: g.released,
      genres: g.genres?.map((x: any) => x.name) || [],
      added: g.added,
      ratingsCount: g.ratings_count,
      suggestionsCount: g.suggestions_count,
      metacritic: g.metacritic,
    }));

    return cleaned;
  } catch (err) {
    throw new AppError("Failed to fetch RAWG data", 502);
  }
}
async function searchBestMatch(query: string, pageSize: number) {

  if (!RAWG_BASE_URL || !RAWG_API_KEY) {
    throw new AppError("RAWG API is not configured", 500);
  }

  try {
    const url = `${RAWG_BASE_URL}/games`;
    const response = await axios.get(url, {
     params: {
    key: RAWG_API_KEY,
    search: query,
    page_size: pageSize,
    search_precise: true,
},
      timeout: 8000,
    });

    const results = response.data.results;

    const cleaned = results.map((g: any) => ({
      id: g.id,
      name: g.name,
      imageURL: g.background_image,
      rating: g.rating,
      released: g.released,
      genres: g.genres?.map((x: any) => x.name) || [],
      added: g.added,
      ratingsCount: g.ratings_count,
      suggestionsCount: g.suggestions_count,
      metacritic: g.metacritic,
    }));

    return cleaned;
  } catch (err) {
    throw new AppError("Failed to fetch RAWG data", 502);
  }
}
/**
 * Popular games in any of the given RAWG genre slugs (or overall, when none),
 * used by recommendations to find titles the user doesn't own yet.
 */
async function discoverByGenres(genreSlugs: string[], pageSize = 40, tagSlugs: string[] = []) {
  if (!RAWG_BASE_URL || !RAWG_API_KEY) {
    throw new AppError("RAWG API is not configured", 500);
  }

  try {
    const response = await axios.get(`${RAWG_BASE_URL}/games`, {
      params: {
        key: RAWG_API_KEY,
        ...(genreSlugs.length > 0 ? { genres: genreSlugs.join(",") } : {}),
        // RAWG tags ("roguelike", "souls-like") are where play styles live; genres are broad.
        ...(tagSlugs.length > 0 ? { tags: tagSlugs.join(",") } : {}),
        ordering: "-added",
        page_size: pageSize,
      },
      timeout: 15000,
    });

    return (response.data.results || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      imageURL: g.background_image,
      rating: g.rating,
      released: g.released,
      genres: g.genres?.map((x: any) => x.name) || [],
      metacritic: g.metacritic,
      avgHours: playtimeFor(g.name, typeof g.playtime === "number" ? g.playtime : undefined),
      tags: (g.tags ?? []).map((t: any) => String(t.slug)),
    }));
  } catch (err) {
    throw new AppError("Failed to fetch RAWG data", 502);
  }
}

async function getGameDetails(rawgId: string | number) {
  if (!RAWG_BASE_URL || !RAWG_API_KEY) {
    throw new AppError("RAWG API is not configured", 500);
  }

  try {
    const [detailsResponse, screenshotsResponse, moviesResponse] = await Promise.all([
      axios.get(`${RAWG_BASE_URL}/games/${rawgId}`, {
        params: {
          key: RAWG_API_KEY,
        },
      }),
      axios.get(`${RAWG_BASE_URL}/games/${rawgId}/screenshots`, {
        params: {
          key: RAWG_API_KEY,
        },
      }),
      axios.get(`${RAWG_BASE_URL}/games/${rawgId}/movies`, {
        params: {
          key: RAWG_API_KEY,
        },
      }).catch(() => ({ data: { results: [] } })),
    ]);

    const g = detailsResponse.data;

    const screenshots = screenshotsResponse.data.results?.map((s: any) => s.image) || [];
    const trailers = moviesResponse.data.results?.map((m: any) => m.data?.max || m.data?.["480"] || "")
      .filter((t: string) => t !== "") || [];

    return {
      id: g.id,
      name: g.name,
      // RAWG often appends a full Spanish translation after an "Español" line.
      // RAWG's "###Story" markdown headings become plain paragraph breaks.
      description: typeof g.description_raw === "string"
        ? g.description_raw
            .split(/\n\s*Español\s*:?\s*\n/i)[0]
            .replace(/\s*#{2,6}\s*(?=[A-Za-z])/g, "\n\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
        : g.description_raw,

      imageURL: g.background_image,
      imageAlt: g.background_image_additional,

      screenshots: screenshots,
      trailers: trailers,

      rating: g.rating,
      ratingsCount: g.ratings_count,

      released: g.released,

      website: g.website,

      metacritic: g.metacritic,

      playtime: playtimeFor(g.name, g.playtime),

      genres: g.genres?.map((x: any) => x.name) || [],

      platforms: g.platforms?.map((p: any) => p.platform.name) || [],

      developers: g.developers?.map((d: any) => d.name) || [],

      publishers: g.publishers?.map((p: any) => p.name) || [],

      tags: g.tags?.slice(0, 10).map((t: any) => t.name) || [],
    };
  } catch (err) {
    throw new AppError("RAWG game not found", 404);
  }
}

/** One game's tag slugs ("roguelike", "co-op") and average playtime, from a single light request. */
export interface GameFacts {
  tags: string[];
  playtime: number;
  name?: string;
  released?: string | null;
  genres?: string[];
  developers?: string[];
}

async function getGameFacts(rawgId: string | number): Promise<GameFacts> {
  if (!RAWG_BASE_URL || !RAWG_API_KEY) return { tags: [], playtime: 0 };
  try {
    const res = await axios.get(`${RAWG_BASE_URL}/games/${rawgId}`, { params: { key: RAWG_API_KEY }, timeout: 8000 });
    return {
      tags: (res.data?.tags ?? []).map((t: any) => String(t.slug)),
      playtime: playtimeFor(res.data?.name, typeof res.data?.playtime === "number" ? res.data.playtime : 0) ?? 0,
      name: res.data?.name,
      released: res.data?.released ?? null,
      genres: (res.data?.genres ?? []).map((g: any) => String(g.name)),
      developers: (res.data?.developers ?? []).map((d: any) => String(d.name)),
    };
  } catch {
    return { tags: [], playtime: 0 };
  }
}

/** RAWG tag slugs for one game: how it plays, beyond its genres. */
async function getGameTagSlugs(rawgId: string | number): Promise<string[]> {
  return (await getGameFacts(rawgId)).tags;
}

export default {
  getGameFacts,
  getGameTagSlugs,
  searchGames,
  getGameDetails,
  searchBestMatch,
  discoverByGenres,
};
