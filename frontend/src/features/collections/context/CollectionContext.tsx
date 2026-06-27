import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import { useToast } from "@chakra-ui/react";

import collectionApi from "../api/collectionApi";
import type { Collection } from "../types/collection";

interface CollectionContextType {
  collections: Collection[];
  loading: boolean;

  fetchCollections: () => Promise<void>;

  createCollection: (
    name: string,
    description?: string
  ) => Promise<void>;

  deleteCollection: (
    collectionId: string
  ) => Promise<void>;

  addGameToCollection: (
    collectionId: string,
    gameId: string
  ) => Promise<void>;

  removeGameFromCollection: (
    collectionId: string,
    gameId: string
  ) => Promise<void>;

  removeGameEverywhere: (
    gameId: string
  ) => void;
}

const CollectionContext =
  createContext<CollectionContextType | undefined>(
    undefined
  );

export function CollectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const toast = useToast();

  const [collections, setCollections] =
    useState<Collection[]>([]);

  const [loading, setLoading] =
    useState(false);

 const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);

      const data = await collectionApi.getCollections();

      setCollections(data);
    } finally {
      setLoading(false);
    }
}, []);

  const createCollection = async (
    name: string,
    description?: string
  ) => {
    const created =
      await collectionApi.createCollection(
        name,
        description
      );

    setCollections((prev) => [
      created,
      ...prev,
    ]);

    toast({
      title: "Collection Created",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const deleteCollection = async (
    collectionId: string
  ) => {
    await collectionApi.deleteCollection(
      collectionId
    );

    setCollections((prev) =>
      prev.filter(
        (c) => c._id !== collectionId
      )
    );

    toast({
      title: "Collection Deleted",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const addGameToCollection =
    async (
      collectionId: string,
      gameId: string
    ) => {
      const updated =
        await collectionApi.addGameToCollection(
          collectionId,
          gameId
        );

      setCollections((prev) =>
        prev.map((collection) =>
          collection._id === collectionId
            ? updated
            : collection
        )
      );

      toast({
        title: "Game Added",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    };

  const removeGameFromCollection =
    async (
      collectionId: string,
      gameId: string
    ) => {
      const updated =
        await collectionApi.removeGameFromCollection(
          collectionId,
          gameId
        );

      setCollections((prev) =>
        prev.map((collection) =>
          collection._id === collectionId
            ? updated
            : collection
        )
      );

      toast({
        title: "Game Removed",
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    };

  const removeGameEverywhere = (
    gameId: string
  ) => {
    setCollections((prev) =>
      prev.map((collection) => ({
        ...collection,
        gameIds: collection.gameIds.filter(
          (game) => game._id !== gameId
        ),
      }))
    );
  };

  return (
    <CollectionContext.Provider
      value={{
        collections,
        loading,

        fetchCollections,

        createCollection,

        deleteCollection,

        addGameToCollection,

        removeGameFromCollection,

        removeGameEverywhere,
      }}
    >
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection() {
  const context =
    useContext(CollectionContext);

  if (!context) {
    throw new Error(
      "useCollection must be used inside CollectionProvider"
    );
  }

  return context;
}