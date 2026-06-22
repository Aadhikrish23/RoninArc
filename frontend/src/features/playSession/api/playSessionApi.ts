import api from "../../../shared/api/axiosInstance";

const startSession = async (
  gameId: string
) => {
  const response =
    await api.post(
      `/play-session/start/${gameId}`
    );

  return response.data.Data;
};

const endSession = async (
  gameId: string
) => {
  const response =
    await api.post(
      `/play-session/end/${gameId}`
    );

  return response.data.Data;
};

const getRecentSessions =
  async () => {
    const response =
      await api.get(
        "/play-session/recent"
      );

    return response.data.Data;
  };

const getPlaytimeStats =
  async () => {
    const response =
      await api.get(
        "/play-session/stats"
      );

    return response.data.Data;
  };

const getGamePlaytime = async (gameId: string) => {
  const response = await api.get(`/play-session/game/${gameId}`);
  return response.data.Data;
};

export default {
  startSession,
  endSession,
  getRecentSessions,
  getPlaytimeStats,
  getGamePlaytime,
};