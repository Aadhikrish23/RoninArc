/**
 * What the model sees of the user's collection of things (games, books...), so it can name them
 * exactly. The domain pack loads it; the core only passes it along.
 */
export interface LibrarySnapshot {
  /** Newest first: title and status (and id, as titles aren't unique). */
  games: { title: string; status: string; id?: string }[];
  totalGames: number;
  collections: string[];
}
