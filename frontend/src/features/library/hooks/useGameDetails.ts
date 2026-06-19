import { useEffect, useState } from "react";

import libraryApi from "../api/libraryApi";

import type {
  RawgGameDetails,
} from "../types/library";

export function useGameDetails(
  rawgId?: string
) {
  const [game, setGame] =
    useState<RawgGameDetails | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!rawgId) return;

    const load = async () => {
      try {
        setLoading(true);

        const data =
          await libraryApi.getRawgGameDetails(
            rawgId
          );

        setGame(data);
      } catch {
        setError(
          "Failed to load game"
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [rawgId]);

  return {
    game,
    loading,
    error,
  };
}