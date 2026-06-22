import { useState, useCallback } from "react";
import playSessionApi from "../api/playSessionApi";

import type { PlaySession, PlaytimeStats, GamePlaytimeStats } from "../types/playSession";

export function usePlaySession() {
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<PlaytimeStats | null>(null);

  const [recentSessions, setRecentSessions] = useState<PlaySession[]>([]);

  const [gameStats, setGameStats] = useState<GamePlaytimeStats | null>(null);

  const startSession = useCallback(async (gameId: string) => {
    return playSessionApi.startSession(gameId);
  }, []);

  const endSession = useCallback(
    async (gameId: string) => {
      return playSessionApi.endSession(gameId);
    },
    []
  );

  const loadStats = useCallback(
    async () => {
      setLoading(true);

      try {
        const data =
          await playSessionApi.getPlaytimeStats();

        setStats(data);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadRecentSessions = useCallback(
    async () => {
      const data =
        await playSessionApi.getRecentSessions();

      setRecentSessions(data);
    },
    []
  );

  const loadGameStats = useCallback(
    async (gameId: string) => {
      setLoading(true);
      try {
        const data = await playSessionApi.getGamePlaytime(gameId);
        setGameStats(data);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,

    stats,
    recentSessions,
    gameStats,

    startSession,
    endSession,

    loadStats,
    loadRecentSessions,
    loadGameStats,
  };
}

