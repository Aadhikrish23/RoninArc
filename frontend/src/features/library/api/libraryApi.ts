import api from "../../../shared/api/axiosInstance";
import type {
  Game,
  UpdateGamePayload,
  AddGamePayload,
  GameDbDetails,
  SearchResponse,
} from "../types/library";

const getUserLibrary = async (): Promise<Game[]> => {
  const gamedata = await api.get<{ Status: string; Data: Game[] }>("/game");
  return gamedata.data.Data;
};

const getGameById = async (id: string): Promise<Game> => {
  const gameData = await api.get<{ Status: string; Data: Game }>(`/game/${id}`);
  return gameData.data.Data;
};

const addGame = async (payload: AddGamePayload): Promise<Game> => {
  const gamedata = await api.post<{ Status: string; Data: Game }>(
    "/game/add",
    payload,
  );
  return gamedata.data.Data;
};

const updateGame = async (
  id: string,
  payload: UpdateGamePayload,
): Promise<Game> => {
  const gameData = await api.patch<{ Status: string; Data: Game }>(
    `/game/${id}`,
    payload,
  );
  return gameData.data.Data;
};
const deleteGame = async (id: string): Promise<void> => {
  await api.delete(`/game/${id}`);
};

const searchGames = async (
  query: string,
  page = 1,
): Promise<SearchResponse> => {
  const response = await api.get<{ Status: string; Data: SearchResponse }>(
    "/igdb/search",
    {
      params: { query, page },
    },
  );
  return response.data.Data;
};
const getGameDbDetails = async (
  id: number | string,
): Promise<GameDbDetails> => {
  const response = await api.get<{
    Status: string;
    Data: GameDbDetails;
  }>(`/igdb/${id}`);

  return response.data.Data;
};
export default {
  getUserLibrary,
  getGameById,
  addGame,
  updateGame,
  deleteGame,
  searchGames,
  getGameDbDetails,
};
