import axios from "axios";
import AppError from "../../shared/errors/AppError";
import dotenv from "dotenv";
dotenv.config();

const RAWG_BASE_URL = process.env.RAWG_BASE_URL;
const RAWG_API_KEY = process.env.RAWG_API_KEY;

async function searchGames(query: string, page: number) {
  console.log(">>> RAWG SERVICE searchGames HIT <<<");

  if (!RAWG_BASE_URL || !RAWG_API_KEY) {
    throw new AppError("RAWG API is not configured", 500);
  }

  try {
    const url = `${RAWG_BASE_URL}/games`;
    const response = await axios.get(url, {
      params: {
        key: RAWG_API_KEY,
        search: query,
        page,

        search_precise: true,
        ordering: "-added",
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
    const url = `${RAWG_BASE_URL}/games/${rawgId}`;

    const response = await axios.get(url, {
      params: {
        key: RAWG_API_KEY,
      },
    });

    const g = response.data;
    return {
      id: g.id,
      name: g.name,
      description: g.description_raw || g.description,
      imageURL: g.background_image,
      imageAlt: g.background_image_additional,
      rating: g.rating,
      released: g.released,
      website: g.website,
      metacritic: g.metacritic,
      genres: g.genres?.map((x: any) => x.name) || [],
      platforms: g.platforms?.map((p: any) => p.platform.name) || [],
    };
  } catch (err) {
    throw new AppError("RAWG game not found", 404);
  }
}

export default {
  searchGames,
  getGameDetails,
};
