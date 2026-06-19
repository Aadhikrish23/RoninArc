import api from "../../../shared/api/axiosInstance";

const getActivities = async () => {
  const response =
    await api.get("/activity");

  return response.data.Data;
};

const recordLaunch = async (
  gameId: string
) => {
  await api.post(
    `/activity/launch/${gameId}`
  );
};

export default {
  getActivities,
  recordLaunch,
};