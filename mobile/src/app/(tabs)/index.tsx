import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Link, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { Game, Recommendation } from "@/api/client";
import { useCollections, useGames, useInvalidateLibrary, useRecommendations } from "@/data/hooks";
import { Button, Card, Cover, Empty, ErrorNote, Heading, Loading, Screen, SectionTitle, T } from "@/ui/components";
import { GameTile } from "@/ui/GameTile";
import { radius, space, useColors } from "@/ui/theme";

const isFavourite = (g: Game) => typeof g.rating === "number" && g.rating >= 8;

function Shelf({ title, games, action }: { title: string; games: Game[]; action?: React.ReactNode }) {
  if (games.length === 0) return null;
  return (
    <View>
      <SectionTitle title={title} action={action} />
      <FlatList horizontal data={games} keyExtractor={(g) => g._id} renderItem={({ item }) => <GameTile game={item} />} ItemSeparatorComponent={() => <View style={{ width: space.md }} />} showsHorizontalScrollIndicator={false} />
    </View>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (rec.gameId ? router.push({ pathname: "/game/[id]", params: { id: rec.gameId } }) : router.push({ pathname: "/add", params: { q: rec.title } }))}
      style={({ pressed }) => ({ width: 240, flexDirection: "row", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, opacity: pressed ? 0.8 : 1 })}
    >
      <Cover uri={rec.imageURL} title={rec.title} width={56} height={74} rounded={radius.sm} />
      <View style={{ flex: 1, gap: 4 }}>
        <T weight="600" numberOfLines={2}>
          {rec.title}
        </T>
        <T size="xs" tone="muted" numberOfLines={3}>
          {rec.reasons?.[0] ?? ""}
        </T>
      </View>
    </Pressable>
  );
}

export default function Library() {
  const games = useGames();
  const collections = useCollections();
  const recs = useRecommendations();
  const invalidate = useInvalidateLibrary();
  const [refreshing, setRefreshing] = useState(false);
  const c = useColors();

  const shelves = useMemo(() => {
    const list = games.data ?? [];
    const newest = [...list].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    // A row doesn't repeat games already shown above it.
    const fresh = newest.filter((g) => !["playing", "paused", "completed"].includes(g.progressStatus) && !isFavourite(g));
    return {
      continuePlaying: [...list.filter((g) => g.progressStatus === "playing"), ...list.filter((g) => g.progressStatus === "paused")],
      favourites: list.filter(isFavourite),
      recent: (list.length > 8 && fresh.length < 4 ? newest : fresh).slice(0, 20),
      completed: list.filter((g) => g.progressStatus === "completed" && !isFavourite(g)),
    };
  }, [games.data]);

  const picks = [...(recs.data?.backlog ?? []), ...(recs.data?.discover ?? [])].slice(0, 8);

  const refresh = async () => {
    setRefreshing(true);
    await invalidate();
    setRefreshing(false);
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Heading>Library</Heading>
        <Link href="/games" asChild>
          <Button title="All games" variant="ghost" icon="list" />
        </Link>
      </View>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Search for a game to add"
        onPress={() => router.push("/add")}
        style={{ marginTop: space.md, flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 46, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.card }}
      >
        <Feather name="search" size={18} color={c.faint} />
        <T tone="faint">Search for a game to add</T>
      </Pressable>

      {games.isLoading ? (
        <Loading />
      ) : games.error ? (
        <ErrorNote error={games.error} onRetry={() => games.refetch()} />
      ) : (games.data ?? []).length === 0 ? (
        <Empty icon="book-open" title="Your library is empty" body="Search for a game you own and add it, or sync your PC's library from RoninArc on your PC." action={<Button title="Add a game" icon="plus" onPress={() => router.push("/add")} />} />
      ) : (
        <>
          <Shelf title="Continue playing" games={shelves.continuePlaying} />
          <Shelf title="Favourites (rated 8+)" games={shelves.favourites} />
          {picks.length > 0 && (
            <View>
              <SectionTitle title="Recommended for you" />
              <FlatList horizontal data={picks} keyExtractor={(r, i) => `${r.rawgId ?? r.gameId ?? i}`} renderItem={({ item }) => <RecommendationCard rec={item} />} ItemSeparatorComponent={() => <View style={{ width: space.md }} />} showsHorizontalScrollIndicator={false} />
            </View>
          )}
          {(collections.data ?? []).length > 0 && (
            <View>
              <SectionTitle title="Collections" />
              <View style={{ gap: space.sm }}>
                {(collections.data ?? []).map((col) => (
                  <Link key={col._id} href={{ pathname: "/collection/[id]", params: { id: col._id } }} asChild>
                    <Pressable accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.md }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                          <Feather name="folder" size={18} color={c.accent} />
                          <T weight="600">{col.name}</T>
                        </View>
                        <T tone="muted" size="sm">
                          {col.gameIds.length} {col.gameIds.length === 1 ? "game" : "games"}
                        </T>
                      </Card>
                    </Pressable>
                  </Link>
                ))}
              </View>
            </View>
          )}
          <Shelf title="Recently added" games={shelves.recent} />
          <Shelf title="Completed games" games={shelves.completed} />
        </>
      )}
    </Screen>
  );
}
