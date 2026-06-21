import { useState } from "react";

import playSessionApi
from "../api/playSessionApi";

import type {
  PlaySession,
  PlaytimeStats,
} from "../types/playSession";

export function usePlaySession() {
  const [loading, setLoading] =
    useState(false);

  const [stats, setStats] =
    useState<PlaytimeStats | null>(
      null
    );

  const [recentSessions,
    setRecentSessions] =
    useState<PlaySession[]>([]);

  const startSession =
    async (gameId: string) => {
      return playSessionApi
        .startSession(gameId);
    };

  const endSession =
    async (gameId: string) => {
      return playSessionApi
        .endSession(gameId);
    };

  const loadStats =
    async () => {
      setLoading(true);

      try {
        const data =
          await playSessionApi
            .getPlaytimeStats();

        setStats(data);
      } finally {
        setLoading(false);
      }
    };

  const loadRecentSessions =
    async () => {
      const data =
        await playSessionApi
          .getRecentSessions();

      setRecentSessions(data);
    };

  return {
    loading,

    stats,
    recentSessions,

    startSession,
    endSession,

    loadStats,
    loadRecentSessions,
  };
}