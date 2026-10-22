import { Pressable, View } from "react-native";
import { router } from "expo-router";
import type { Game } from "@/api/client";
import { Cover, StatusPill, T } from "./components";
import { space } from "./theme";

/** A game in a horizontal row on the library home: cover, title, status. */
export function GameTile({ game }: { game: Game }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${game.title}, ${game.progressStatus}`}
      onPress={() => router.push({ pathname: "/game/[id]", params: { id: game._id } })}
      style={({ pressed }) => ({ width: 128, gap: space.xs, opacity: pressed ? 0.75 : 1 })}
    >
      <Cover uri={game.imageURL} title={game.title} width={128} height={170} />
      <T size="sm" weight="600" numberOfLines={2} style={{ minHeight: 36 }}>
        {game.title}
      </T>
      <View>
        <StatusPill status={game.progressStatus} />
      </View>
    </Pressable>
  );
}
