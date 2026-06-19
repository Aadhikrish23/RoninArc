import type { Game } from "../../library/types/library";

export interface DashboardStats {
  totalGames: number;
  playing: number;
  completed: number;
  dropped: number;
  plan: number;

  continuePlaying: Game[];
  recentGames: Game[];

  featuredGame: Game | null;
  highestRatedGame: Game | null;

  reviewsWritten: number;
  averageRating: string;
}