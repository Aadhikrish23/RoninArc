export type Status = "plan" | "playing" | "completed" | "dropped";

export interface Game {
  _id: string;
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
  description:string;
  imageURL: string;
  released: string;
  rating: number;
  genres: string[];
}
