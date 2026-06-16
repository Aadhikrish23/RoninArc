import type { Game } from "../../../types/library";

export interface Collection {
  _id: string;

  name: string;

  description: string;

  gameIds: Game[];

  createdAt: string;

  updatedAt: string;
}