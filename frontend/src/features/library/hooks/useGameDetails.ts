import { useEffect, useState } from "react";
import libraryApi from "../api/libraryApi";
import type { RawgGameDetails, Game } from "../types/library";

const mapLocalGameToRawgDetails = (game: Game): RawgGameDetails => ({
  id: game.rawgId || 0,
  name: game.title,
  description: game.description || "No description available.",
  imageURL: game.imageURL || "",
  imageAlt: game.title,
  screenshots: game.screenshots || [],
  rating: game.rawgRating || game.rating || 0,
  ratingsCount: 0,
  released: game.metadataSyncedAt
    ? new Date(game.metadataSyncedAt).toLocaleDateString()
    : "",
  website: game.website || "",
  metacritic: game.metacritic || null,
  playtime: game.playtime || 0,
  genres: game.tags || [],
  platforms: game.provider === "epic" ? ["PC"] : [],
  developers: game.developers || (game.developer ? [game.developer] : []),
  publishers: game.publishers || [],
  tags: game.tags || [],
});

export function useGameDetails(id?: string, localGame?: Game | null) {
  const [game, setGame] = useState<RawgGameDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);

        if (isMongoId) {
          // Always ask backend for the latest game.
          const libraryGame = await libraryApi.getGameById(id);

          if (libraryGame.rawgId) {
            const rawgGame = await libraryApi.getRawgGameDetails(
              libraryGame.rawgId,
            );

            setGame(rawgGame);
          } else {
            setGame(mapLocalGameToRawgDetails(libraryGame));
          }

          return;
        } else {
          // RAWG ID
          const data = await libraryApi.getRawgGameDetails(id);
          setGame(data);
        }
      } catch (err) {
        if (localGame) {
          setGame(mapLocalGameToRawgDetails(localGame));
        } else {
          setError("Failed to load game details");
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  return {
    game,
    loading,
    error,
  };
}
