import { router, useLocalSearchParams } from "expo-router";
import { useCollections, useGames } from "@/data/hooks";
import { Empty, Loading, PageHeader, Screen } from "@/ui/components";
import { GameGrid } from "@/ui/GameTile";
import { space } from "@/ui/theme";
import { View } from "react-native";

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const collections = useCollections();
  const games = useGames();
  if (collections.isLoading || games.isLoading) return <Loading />;
  const col = collections.data?.find((x) => x._id === id);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  if (!col) {
    return (
      <Screen>
        <PageHeader title="Collection" onBack={back} />
        <Empty icon="folder" title="This collection is gone" body="It may have been deleted on another device." />
      </Screen>
    );
  }
  const ids = new Set(col.gameIds.map((x) => (typeof x === "string" ? x : x._id)));
  const list = (games.data ?? []).filter((g) => ids.has(g._id));

  return (
    <Screen>
      <PageHeader title={col.name} subtitle={`${list.length} ${list.length === 1 ? "game" : "games"}`} onBack={back} />
      <View style={{ marginTop: space.lg }}>
        {list.length === 0 ? <Empty icon="folder-plus" title="No games in here yet" body="Open a game and pick this collection under Collections." /> : <GameGrid games={list} />}
      </View>
    </Screen>
  );
}
