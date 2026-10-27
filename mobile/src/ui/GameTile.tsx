import { Pressable, View } from "react-native";
import { router } from "expo-router";
import type { Game } from "@/api/client";
import { Cover, RatingLine, StatusBadge, T } from "./components";
import { cardShadow, radius, space, useColors } from "./theme";

export const TILE_WIDTH = 164;
const COVER_HEIGHT = 140;

/**
 * A game on the library home, built like the desktop's GameCard: a bordered card with the
 * cover on top and the status badge on it, then the title, genres and rating.
 */
export function GameTile({ game }: { game: Game }) {
  const c = useColors();
  const genres = (game.tags ?? []).slice(0, 3).join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${game.title}, ${game.progressStatus}`}
      onPress={() => router.push({ pathname: "/game/[id]", params: { id: game._id } })}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: pressed ? c.accent : c.border,
        backgroundColor: c.card,
        overflow: "hidden",
        transform: [{ scale: pressed ? 0.98 : 1 }],
        ...cardShadow,
      })}
    >
      <View>
        <Cover uri={game.imageURL} title={game.title} width={TILE_WIDTH} height={COVER_HEIGHT} rounded={0} />
        <View style={{ position: "absolute", top: space.sm, right: space.sm }}>
          <StatusBadge status={game.progressStatus} />
        </View>
      </View>
      <View style={{ padding: space.md, gap: 2, minHeight: 78 }}>
        <T weight="700" numberOfLines={2}>
          {game.title}
        </T>
        {genres ? (
          <T size="xs" tone="muted" numberOfLines={1}>
            {genres}
          </T>
        ) : null}
        {typeof game.rating === "number" ? (
          <View style={{ marginTop: 4 }}>
            <RatingLine rating={game.rating} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
