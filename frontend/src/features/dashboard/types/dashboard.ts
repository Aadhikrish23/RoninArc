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