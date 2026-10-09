import type { Game } from "../../library/types/library";

export interface DashboardStats {
  totalGames: number;
  owned: number;
  installed: number;
  playing: number;
  completed: number;

  continuePlaying: Game[];
  recentGames: Game[];

  genreStats: {
    genre: string;
    count: number;
  }[];

  statusStats: {
    status: string;
    count: number;
  }[];
}
export interface DashboardGameSummary {
  _id: string;
  title: string;
  imageURL: string | null;
  rawgId: number | null;
  progressStatus: string;
}

export interface DashboardOverview {
  continuePlaying: { game: DashboardGameSummary; lastPlayed: string | null; minutesPlayed: number }[];
  playtime: {
    last7DaysMinutes: number;
    last30DaysMinutes: number;
    totalMinutes: number;
    sessionsLast7Days: number;
    daily: { date: string; minutes: number }[];
    mostPlayed: { game: DashboardGameSummary; minutesPlayed: number }[];
  };
  /** Plan to Play + Playing + Paused; no-status games are only counted in unsortedCount. */
  backlog: {
    size: number;
    byStatus: Record<"none" | "plan" | "playing" | "paused" | "completed" | "dropped", number>;
    completedThisYear: number;
    unsortedCount: number;
    untouchedCount: number;
    untouched: { game: DashboardGameSummary; plannedAt: string }[];
  };
  recentActivity: { _id: string; type: string; message: string; createdAt: string; game: DashboardGameSummary | null }[];
}
