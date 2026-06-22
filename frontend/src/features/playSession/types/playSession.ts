import type { Game }
from "../../library/types/library";

export interface PlaySession {
  _id: string;

  gameId: Game;

  startedAt: string;

  endedAt: string | null;

  durationMinutes: number;
}

export interface PlaytimeStats {
  totalMinutes: number;

  totalHours: number;

  totalSessions: number;

  averageSessionMinutes: number;

  mostPlayedGame: Game | null;

  mostPlayedMinutes: number;
}

export interface GamePlaytimeStats {
  totalHours: number;
  lastPlayed: string | null;
}