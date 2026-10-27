import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { Collection, Game, Recommendation } from "@/api/client";
import { useAddGame, useCollections, useDismissRecommendation, useGames, useInvalidateLibrary, useRecommendations } from "@/data/hooks";
import { Button, Cover, Empty, ErrorNote, Loading, Screen, SectionTitle, T, Tag } from "@/ui/components";
import { GameTile } from "@/ui/GameTile";
import { cardShadow, radius, space, useColors } from "@/ui/theme";

const isFavourite = (g: Game) => typeof g.rating === "number" && g.rating >= 8;

function Shelf({ title, games }: { title: string; games: Game[] }) {
  if (games.length === 0) return null;
  return (
    <View>
      <SectionTitle title={title} />
      <FlatList
        horizontal
        data={games}
        keyExtractor={(g) => g._id}
        renderItem={({ item }) => <GameTile game={item} />}
        ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
        showsHorizontalScrollIndicator={false}
        // Room for the cards' shadow, which a horizontal list would otherwise clip.
        contentContainerStyle={{ paddingBottom: space.xs, paddingHorizontal: 1 }}
      />
    </View>
  );
}

/** Like the desktop's collection cards: the first two covers side by side, the name, a game count. */
function CollectionCard({ collection, covers }: { collection: Collection; covers: Game[] }) {
  const c = useColors();
  const width = 200;
  const count = collection.gameIds.length;
  return (
    <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${collection.name}, ${count} ${count === 1 ? "game" : "games"}`}
        onPress={() => router.push({ pathname: "/collection/[id]", params: { id: collection._id } })}
        style={({ pressed }) => ({ width, borderRadius: radius.lg, borderWidth: 1, borderColor: pressed ? c.accent : c.border, backgroundColor: c.card, overflow: "hidden", ...cardShadow })}
      >
        <View style={{ flexDirection: "row", height: 112, backgroundColor: c.cardAlt }}>
          {covers.length === 0 ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <Feather name="folder" size={28} color={c.faint} />
            </View>
          ) : (
            covers.slice(0, 2).map((g) => <Cover key={g._id} uri={g.imageURL} title={g.title} width={covers.length === 1 ? width : width / 2} height={112} rounded={0} />)
          )}
        </View>
        <View style={{ padding: space.md, gap: space.sm }}>
          <T weight="700" numberOfLines={1}>
            {collection.name}
          </T>
          <Tag tone="accent" label={`${count} ${count === 1 ? "game" : "games"}`} />
        </View>
      </Pressable>
  );
}

/** Like the desktop's recommendation cards: cover, title, genre tags, why, and the two actions. */
function RecommendationCard({ rec, topPick }: { rec: Recommendation; topPick: boolean }) {
  const c = useColors();
  const add = useAddGame();
  const dismiss = useDismissRecommendation();
  const owned = rec.source === "library";
  const open = () => (rec.gameId ? router.push({ pathname: "/game/[id]", params: { id: rec.gameId } }) : router.push({ pathname: "/add", params: { q: rec.title } }));
  return (
    <View style={{ width: 260, justifyContent: "space-between", borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, overflow: "hidden", ...cardShadow }}>
      <Pressable accessibilityRole="button" accessibilityLabel={rec.title} onPress={open}>
        <View>
          <Cover uri={rec.imageURL} title={rec.title} width={260} height={128} rounded={0} />
          {topPick ? (
            <View style={{ position: "absolute", top: space.sm, right: space.sm, borderRadius: radius.pill, backgroundColor: c.accent, paddingHorizontal: 8, paddingVertical: 3 }}>
              <T size="xs" weight="700" style={{ color: c.onAccent }}>
                Top pick
              </T>
            </View>
          ) : null}
        </View>
        <View style={{ padding: space.md, paddingBottom: 0, gap: space.sm }}>
          <T weight="700" numberOfLines={1}>
            {rec.title}
          </T>
          {rec.genres.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {rec.genres.slice(0, 3).map((g) => (
                <Tag key={g} label={g} />
              ))}
            </View>
          ) : null}
          {rec.reasons.slice(0, 2).map((r) => (
            <T key={r} size="xs" tone="muted" numberOfLines={2}>
              {r}
            </T>
          ))}
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", gap: space.sm, padding: space.md }}>
        {owned ? (
          <Button title="Open" variant="outline" onPress={open} style={{ flex: 1, minHeight: 36 }} />
        ) : (
          <>
            <Button
              title="Add to library"
              loading={add.isPending}
              disabled={!rec.rawgId}
              onPress={() => rec.rawgId && add.mutate({ id: rec.rawgId, name: rec.title, imageURL: rec.imageURL ?? null, genres: rec.genres })}
              style={{ flex: 1, minHeight: 36, paddingHorizontal: space.sm }}
            />
            <Button
              title="Not interested"
              variant="outline"
              disabled={!rec.rawgId}
              onPress={() => rec.rawgId && dismiss.mutate(rec.rawgId)}
              style={{ flex: 1, minHeight: 36, paddingHorizontal: space.sm }}
            />
          </>
        )}
      </View>
    </View>
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

  const byId = useMemo(() => new Map((games.data ?? []).map((g) => [g._id, g])), [games.data]);
  const coversOf = (col: Collection) =>
    col.gameIds.map((id) => byId.get(typeof id === "string" ? id : id._id)).filter((g): g is Game => !!g);

  const picks = [...(recs.data?.backlog ?? []), ...(recs.data?.discover ?? [])].slice(0, 8);

  const refresh = async () => {
    setRefreshing(true);
    await invalidate();
    setRefreshing(false);
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Search games"
        onPress={() => router.push("/add")}
        style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.card }}
      >
        <Feather name="search" size={18} color={c.faint} />
        <T tone="faint">Search games…</T>
      </Pressable>

      <View style={{ marginTop: space.xl, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T size="xxl" weight="700" accessibilityRole="header" style={{ letterSpacing: -0.4 }}>
            My Library
          </T>
          <T size="sm" tone="muted">
            Track your gaming progress and backlog.
          </T>
        </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all games"
            onPress={() => router.push("/games")}
            style={({ pressed }) => ({ minHeight: 36, paddingHorizontal: space.md, justifyContent: "center", borderRadius: radius.sm, borderWidth: 1, borderColor: c.accent, backgroundColor: pressed ? c.accentSoft : "transparent" })}
          >
            <T size="sm" weight="600" tone="accent">
              View all games
            </T>
          </Pressable>
      </View>

      {games.isLoading ? (
        <Loading />
      ) : games.error ? (
        <ErrorNote error={games.error} onRetry={() => games.refetch()} />
      ) : (games.data ?? []).length === 0 ? (
        <Empty icon="book-open" title="Your library is empty" body="Search for a game you own and add it, or sync your PC's library from RoninArc on your PC." action={<Button title="Add a game" icon="plus" onPress={() => router.push("/add")} />} />
      ) : (
        <>
          <Shelf title="Continue playing" games={shelves.continuePlaying} />
          <Shelf title="Favorites (rated 8+)" games={shelves.favourites} />
          {(collections.data ?? []).length > 0 && (
            <View>
              <SectionTitle title="Collections" />
              <FlatList
                horizontal
                data={collections.data ?? []}
                keyExtractor={(col) => col._id}
                renderItem={({ item }) => <CollectionCard collection={item} covers={coversOf(item)} />}
                ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: space.xs, paddingHorizontal: 1 }}
              />
            </View>
          )}
          <Shelf title="Recently added" games={shelves.recent} />
          <Shelf title="Completed games" games={shelves.completed} />
          {picks.length > 0 && (
            <View>
              <SectionTitle title="Recommended for you" />
              <T size="sm" tone="muted" style={{ marginTop: -space.sm, marginBottom: space.md }}>
                New games picked from what you rate, finish and play.
              </T>
              <FlatList
                horizontal
                data={picks}
                keyExtractor={(r, i) => `${r.rawgId ?? r.gameId ?? i}`}
                renderItem={({ item, index }) => <RecommendationCard rec={item} topPick={index === 0 && item.source === "rawg"} />}
                ItemSeparatorComponent={() => <View style={{ width: space.md }} />}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: space.xs, paddingHorizontal: 1 }}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

