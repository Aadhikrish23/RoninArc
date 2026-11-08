export type Status = "none" | "plan" | "playing" | "paused" | "completed" | "dropped";

export interface GameArtwork {
  selectedSource: "manual" | "igdb" | "epic" | "steam" | "gog" | "ea" | "ubisoft" | "xbox";
  sources: Record<string, string>;
}

export interface Game {
  _id: string;
  igdbId?: number | null;
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
    namespace?: string;
    appName?: string;
    productSlug?: string;
    syncedAt: string;
  }>;

  // Enrichment fields
  screenshots?: string[];
  trailers?: string[];
  communityRating?: number;
  criticScore?: number | null;
  website?: string;
  playtime?: number;
  developers?: string[];
  publishers?: string[];

  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  owned: Game[];
  discover: GameSearchResult[];
  totalOwned: number;
  totalDiscover: number;
}


export interface AddGamePayload {
  igdbId: number;
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

export interface GameSearchResult {
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
  criticScore: number | null;
}

export interface GameDbDetails {
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

  criticScore: number | null;

  playtime: number;

  genres: string[];

  platforms: string[];

  developers: string[];

  publishers: string[];

  tags: string[];
}