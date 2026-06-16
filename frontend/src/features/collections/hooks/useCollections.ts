import { useState } from "react";
import { useToast } from "@chakra-ui/react";

import collectionApi from "../api/collectionApi";

import type { Collection } from "../types/collection";

export function useCollections() {
  const toast = useToast();

  const [collections, setCollections] = useState<Collection[]>([]);

  const [loading, setLoading] = useState(false);

  const fetchCollections = async (): Promise<void> => {
    try {
      setLoading(true);

      const data = await collectionApi.getCollections();

      setCollections(data);
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async (
    name: string,
    description?: string,
  ): Promise<void> => {
    const created = await collectionApi.createCollection(name, description);

    setCollections((prev) => [created, ...prev]);

    toast({
      title: "Collection Created",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const deleteCollection = async (collectionId: string): Promise<void> => {
    await collectionApi.deleteCollection(collectionId);

    setCollections((prev) => prev.filter((c) => c._id !== collectionId));

    toast({
      title: "Collection Deleted",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const addGameToCollection = async (
    collectionId: string,
    gameId: string,
  ): Promise<void> => {
    const updated = await collectionApi.addGameToCollection(
      collectionId,
      gameId,
    );

    setCollections((prev) =>
      prev.map((collection) =>
        collection._id === collectionId ? updated : collection,
      ),
    );

    toast({
      title: "Game Added",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const removeGameFromCollection = async (
    collectionId: string,
    gameId: string,
  ): Promise<void> => {
    const updated = await collectionApi.removeGameFromCollection(
      collectionId,
      gameId,
    );

    setCollections((prev) =>
      prev.map((collection) =>
        collection._id === collectionId ? updated : collection,
      ),
    );

    toast({
      title: "Game Removed",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };
  const removeGameEverywhere = (gameId: string) => {
    setCollections((prev) =>
      prev.map((collection) => ({
        ...collection,
        gameIds: collection.gameIds.filter((game) => game._id !== gameId),
      })),
    );
  };
  return {
    collections,
    loading,

    fetchCollections,

    createCollection,
    deleteCollection,

    addGameToCollection,
    removeGameFromCollection,
    removeGameEverywhere,
  };
}
