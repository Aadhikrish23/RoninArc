import axios from "axios";
import AppError from "../../../shared/errors/AppError";

const STEAM_API_BASE = "https://api.steampowered.com";

export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
}

export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  avatarfull?: string;
}

function getApiKey(): string {
  const key = process.env.STEAM_API_KEY;
  if (!key) {
    throw new AppError(
      "Steam sync is not configured: STEAM_API_KEY is missing from the backend environment. Get a free key at https://steamcommunity.com/dev/apikey",
      500,
    );
  }
  return key;
}

/**
 * Fetches every game the account owns -- installed or not. Steam's Web API
 * still respects the account's own "Game details" privacy setting even
 * though the caller has already proven ownership via OpenID, so a private
 * profile legitimately returns zero games; callers should surface that as
 * a distinct, actionable error rather than "no games found."
 */
const getOwnedGames = async (steamId64: string): Promise<SteamOwnedGame[]> => {
  const response = await axios.get(`${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/`, {
    params: {
      key: getApiKey(),
      steamid: steamId64,
      format: "json",
      include_appinfo: true,
      include_played_free_games: true,
    },
  });

  const data = response.data?.response;
  if (!data || typeof data.game_count !== "number") {
    throw new AppError(
      "Steam returned no library data. This usually means the account's \"Game details\" privacy setting is not Public.",
      400,
    );
  }

  return data.games || [];
};

const getPlayerSummary = async (steamId64: string): Promise<SteamPlayerSummary | null> => {
  const response = await axios.get(`${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/`, {
    params: {
      key: getApiKey(),
      steamids: steamId64,
    },
  });

  const players = response.data?.response?.players;
  return players && players.length > 0 ? players[0] : null;
};

export default {
  getOwnedGames,
  getPlayerSummary,
};
