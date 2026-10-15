import { eventBus } from "../../../shared/events/EventBus";
import { useEffect, useState, useCallback } from "react";

import collectionApi from "../api/collectionApi";
import type { Collection } from "../types/collection";
import type { Game } from "../../library/types/library";

export function useCollectionDetails(collectionId?: string) {
  const [collection, setCollection] = useState<Collection | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const loadCollection = useCallback(async () => {
    if (!collectionId) return;

    try {
      setLoading(true);

      const data = await collectionApi.getCollectionById(collectionId);

      setCollection(data);
    } catch {
      setError("Failed to load collection");
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  // The AI assistant can add or remove games while this page is open.
  useEffect(() => {
    const refresh = () => void quietReload();
    const offCollection = eventBus.subscribe("collection.updated", refresh);
    const offLibrary = eventBus.subscribe("library.updated", refresh);
    return () => {
      offCollection();
      offLibrary();
    };
  }, [collectionId]);

  const quietReload = async () => {
    if (!collectionId) return;
    try {
      setCollection(await collectionApi.getCollectionById(collectionId));
    } catch {
      // keep what's on screen
    }
  };

  const replaceGame = (updatedGame: Game) => {
    setCollection((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        gameIds: prev.gameIds.map((game) =>
          game._id === updatedGame._id ? updatedGame : game
        ),
      };
    });
  };
const replaceCollection = (
    updated: Collection
) => {
    setCollection(updated);
};
  return {
    collection,
    loading,
    error,
    refreshCollection: loadCollection,
    replaceGame,replaceCollection
  };
}