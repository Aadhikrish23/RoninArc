export type Status = "none" | "plan" | "playing" | "paused" | "completed" | "dropped";

export interface GameArtwork {
  selectedSource: "manual" | "rawg" | "epic" | "steam" | "gog" | "ea" | "ubisoft" | "xbox";
  sources: Record<string, string>;
}

export interface Game {
  _id: string;
  rawgId?: number | null;
  title: string;
  description: string;
  imageURL: string;
  artwork: GameArtwork;
  developer?: string;
  exePath: string;
  progressStatus: Status;
  tags: string[];
  rating?: number | null;
  provider?: "manual" | "epic" | "steam" | "gog" | "ea" | "ubisoft" | "xbox";
  providerGameId?: string;
  providerTitle?: string;
  normalizedTitle?: string;
  metadataSyncedAt?: string;
  
  // Multi-provider ownership
  providers?: Record<string, {
    providerGameId: string;
    providerTitle?: string;
    owned?: boolean;
    installed?: boolean;
    launcher?: string;
    installPath?: string;
    manifestId?: string;
    executable?: string;
    syncedAt: string;
  }>;

  // Enrichment fields
  screenshots?: string[];
  trailers?: string[];
  rawgRating?: number;
  metacritic?: number | null;
  website?: string;
  playtime?: number;
  developers?: string[];
  publishers?: string[];

  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  owned: Game[];
  discover: RawgGameResult[];
  totalOwned: number;
  totalDiscover: number;
}


export interface AddGamePayload {
  rawgId: number;
  title: string;
  description: string;
  imageURL: string;
  exePath: string;
  tags: string[];
  progressStatus?: Status;
}
export interface UpdateGamePayload {
  title?: string;
  description?: string;
  imageURL?: string;
  exePath?: string;
  tags?: string[];
  progressStatus?: Status;
}

export interface RawgGameResult {
  id: number;
  name: string;
  description: string;
  imageURL: string;
  released: string;
  rating: number;
  genres: string[];
  added: number;
  ratingsCount: number;
  suggestionsCount: number;
  metacritic: number | null;
}

export interface RawgGameDetails {
  id: number;

  name: string;

  description: string;

  imageURL: string;

  imageAlt: string;

  screenshots: string[];

  rating: number;

  ratingsCount: number;

  released: string;

  website: string;

  metacritic: number | null;

  playtime: number;

  genres: string[];

  platforms: string[];

  developers: string[];

  publishers: string[];

  tags: string[];
}