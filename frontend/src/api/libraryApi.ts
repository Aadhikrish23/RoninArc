import api from "./axiosInstance";
import type {
  Game,
  UpdateGamePayload,
  AddGamePayload,
  RawgGameResult,
} from "../types/library";

const getUserLibrary = async (): Promise<Game[]> => {
  const gamedata = await api.get<{ Status: string; Data: Game[] }>("/game");
  return gamedata.data.Data;
};

const addGame = async (payload: AddGamePayload): Promise<Game> => {
  const gamedata = await api.post<{ Status: string; Data: Game }>("/game/add", payload);
  return gamedata.data.Data;
};

const updateGame = async (
  id: string,
  payload: UpdateGamePayload
): Promise<Game> => {
  const gameData = await api.patch<{ Status: string; Data: Game }>(`/game/${id}`, payload);
  return gameData.data.Data;
};
const deleteGame = async (id: string): Promise<void> => {
  await api.delete(`/game/${id}`);
};

const searchRawgGames = async (
  query: string,
  page = 1
): Promise<RawgGameResult[]> => {
  const rawgdata = await api.get<{ Status: string; Data: RawgGameResult[] }>(
    "/rawg/search",
    {
      params: { query, page },
    }
  );
  return rawgdata.data.Data;
};
export default {
  getUserLibrary,
  addGame,
  updateGame,
  deleteGame,
  searchRawgGames,
};
