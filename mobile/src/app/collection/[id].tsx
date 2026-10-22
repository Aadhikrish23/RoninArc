import { View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCollections, useGames } from "@/data/hooks";
import { Cover, Empty, Loading, Row, Screen, StatusPill, T } from "@/ui/components";
import { space, useColors } from "@/ui/theme";

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collections = useCollections();
  const games = useGames();
  const c = useColors();
  if (collections.isLoading || games.isLoading) return <Loading />;
  const col = collections.data?.find((x) => x._id === id);
  if (!col) return <Empty icon="folder" title="This collection is gone" body="It may have been deleted on another device." />;
  const ids = new Set(col.gameIds.map((x) => (typeof x === "string" ? x : x._id)));
  const list = (games.data ?? []).filter((g) => ids.has(g._id));

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: col.name }} />
      <T tone="muted" size="sm" style={{ marginBottom: space.md }}>
        {list.length} {list.length === 1 ? "game" : "games"}
      </T>
      {list.length === 0 ? (
        <Empty icon="folder-plus" title="No games in here yet" body="Open a game and pick this collection under Collections." />
      ) : (
        list.map((g, i) => (
          <View key={g._id}>
            {i > 0 ? <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.sm }} /> : null}
            <Row accessibilityRole="button" accessibilityLabel={g.title} onPress={() => router.push({ pathname: "/game/[id]", params: { id: g._id } })}>
              <Cover uri={g.imageURL} title={g.title} width={44} height={58} />
              <View style={{ flex: 1, gap: 4 }}>
                <T weight="600" numberOfLines={1}>
                  {g.title}
                </T>
                <StatusPill status={g.progressStatus} />
              </View>
            </Row>
          </View>
        ))
      )}
    </Screen>
  );
}
