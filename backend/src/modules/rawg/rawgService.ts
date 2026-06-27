import axios from "axios";
import AppError from "../../shared/errors/AppError";
import dotenv from "dotenv";
dotenv.config();

const RAWG_BASE_URL = process.env.RAWG_BASE_URL;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

async function searchGames(query: string, pageSize : number) {
  console.log(">>> RAWG SERVICE searchGames HIT <<<");
  console.log("Searching RAWG for:", query);

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
      description: g.description_raw,

      imageURL: g.background_image,
      imageAlt: g.background_image_additional,

      screenshots: screenshots,
      trailers: trailers,

      rating: g.rating,
      ratingsCount: g.ratings_count,

      released: g.released,

      website: g.website,

      metacritic: g.metacritic,

      playtime: g.playtime,

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

export default {
  searchGames,
  getGameDetails,
};
