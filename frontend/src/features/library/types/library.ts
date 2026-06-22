export type Status = "plan" | "playing" | "completed" | "dropped";

export interface Game {
  _id: string;
  rawgId: number;
  title: string;
  description: string;
  imageURL: string;
  exePath: string;
  status: Status;
  tags: string[];
  rating?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddGamePayload {
  rawgId: number;
  title: string;
  description: string;
  imageURL: string;
  exePath: string;
  tags: string[];
  status?: Status;
}
export interface UpdateGamePayload {
  title?: string;
  description?: string;
  imageURL?: string;
  exePath?: string;
  tags?: string[];
  status?: Status;
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
export interface EpicGame {
  name: string;
  installPath: string;
  executable: string;
  epicId: string;
}