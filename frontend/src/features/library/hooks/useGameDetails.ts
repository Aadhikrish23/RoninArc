import { useEffect, useState } from "react";
import libraryApi from "../api/libraryApi";
import type { GameDbDetails, Game } from "../types/library";

const localGameToDetails = (game: Game): GameDbDetails => ({
  id: game.igdbId || 0,
  name: game.title,
  description: game.description || "No description available.",
  imageURL: game.imageURL || "",
  imageAlt: game.title,
  screenshots: game.screenshots || [],
  rating: game.communityRating || game.rating || 0,
  ratingsCount: 0,
  released: game.metadataSyncedAt
    ? new Date(game.metadataSyncedAt).toLocaleDateString()
    : "",
  website: game.website || "",
  criticScore: game.criticScore || null,
  playtime: game.playtime || 0,
  genres: game.tags || [],
  platforms: game.provider === "epic" ? ["PC"] : [],
  developers: game.developers || (game.developer ? [game.developer] : []),
  publishers: game.publishers || [],
  tags: game.tags || [],
});

export function useGameDetails(id?: string, localGame?: Game | null) {
  const [game, setGame] = useState<GameDbDetails | null>(null);
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

          if (libraryGame.igdbId) {
            const result = await libraryApi.getGameDbDetails(
              libraryGame.igdbId,
            );

            setGame(result);
          } else {
            setGame(localGameToDetails(libraryGame));
          }

          return;
        } else {
          // A game database id
          const data = await libraryApi.getGameDbDetails(id);
          setGame(data);
        }
      } catch (err) {
        if (localGame) {
          setGame(localGameToDetails(localGame));
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
