import api from "../../../api/axiosInstance";

import type { Collection } from "../types/collection";

const getCollections = async (): Promise<
  Collection[]
> => {
  const response =
    await api.get<{
      Status: string;
      Data: Collection[];
    }>("/collection");

  return response.data.Data;
};

const createCollection = async (
  name: string,
  description?: string
): Promise<Collection> => {
  const response =
    await api.post<{
      Status: string;
      Data: Collection;
    }>("/collection", {
      name,
      description,
    });

  return response.data.Data;
};

const deleteCollection = async (
  collectionId: string
): Promise<void> => {
  await api.delete(
    `/collection/${collectionId}`
  );
};

const addGameToCollection =
  async (
    collectionId: string,
    gameId: string
  ): Promise<Collection> => {
    const response =
      await api.post<{
        Status: string;
        Data: Collection;
      }>(
        `/collection/${collectionId}/games`,
        {
          gameId,
        }
      );

    return response.data.Data;
  };

const removeGameFromCollection =
  async (
    collectionId: string,
    gameId: string
  ): Promise<Collection> => {
    const response =
      await api.delete<{
        Status: string;
        Data: Collection;
      }>(
        `/collection/${collectionId}/games/${gameId}`
      );

    return response.data.Data;
  };

export default {
  getCollections,

  createCollection,

  deleteCollection,

  addGameToCollection,

  removeGameFromCollection,
};