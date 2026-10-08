import type { Status } from "../../library/types/library";

export interface Recommendation {
  source: "library" | "rawg";
  gameId?: string;
  rawgId?: number;
  title: string;
  imageURL?: string;
  genres: string[];
  status?: Status;
  released?: string;
  score: number;
  reasons: string[];
}

export interface RecommendationResult {
  profile: {
    personalized: boolean;
    signalCount: number;
    topGenres: { genre: string; affinity: number }[];
  };
  focus: string[];
  backlog: Recommendation[];
  discover: Recommendation[];
  discoverError?: string;
}

export type RecommendationType = "all" | "backlog" | "discover";
