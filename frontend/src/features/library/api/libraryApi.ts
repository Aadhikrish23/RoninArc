import api from "../../../shared/api/axiosInstance";
import type {
  Game,
  UpdateGamePayload,
  AddGamePayload,
  RawgGameDetails,
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

const searchRawgGames = async (
  query: string,
  page = 1,
): Promise<SearchResponse> => {
  const rawgdata = await api.get<{ Status: string; Data: SearchResponse }>(
    "/rawg/search",
    {
      params: { query, page },
    },
  );
  return rawgdata.data.Data;
};
const getRawgGameDetails = async (
  id: number | string,
): Promise<RawgGameDetails> => {
  const response = await api.get<{
    Status: string;
    Data: RawgGameDetails;
  }>(`/rawg/${id}`);

  return response.data.Data;
};
export default {
  getUserLibrary,
  getGameById,
  addGame,
  updateGame,
  deleteGame,
  searchRawgGames,
  getRawgGameDetails,
};
