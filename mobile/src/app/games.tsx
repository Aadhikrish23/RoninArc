import { useMemo, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import { router } from "expo-router";
import type { Game } from "@/api/client";
import { useGames } from "@/data/hooks";
import { Chip, Cover, Empty, ErrorNote, Field, Loading, Row, StatusPill, T } from "@/ui/components";
import { STATUS, STATUS_ORDER, space, useColors, type ProgressStatus } from "@/ui/theme";

type Sort = "title" | "newest" | "rating";
const SORTS: { key: Sort; label: string }[] = [
  { key: "title", label: "A-Z" },
  { key: "newest", label: "Newest" },
  { key: "rating", label: "Top rated" },
];
// "The Legend of Zelda" sorts under L, the way shelves do.
const sortKey = (title: string) => title.replace(/^(the|a|an)\s+/i, "").toLowerCase();

export default function AllGames() {
  const games = useGames();
  const [status, setStatus] = useState<ProgressStatus | "all">("all");
  const [sort, setSort] = useState<Sort>("title");
  const [text, setText] = useState("");
  const c = useColors();

  const list = useMemo(() => {
    const q = text.trim().toLowerCase();
    const filtered = (games.data ?? []).filter((g) => (status === "all" || g.progressStatus === status) && (!q || g.title.toLowerCase().includes(q)));
    const sorted = [...filtered];
    if (sort === "title") sorted.sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)));
    if (sort === "newest") sorted.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    if (sort === "rating") sorted.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    return sorted;
  }, [games.data, status, sort, text]);

  const total = games.data?.length ?? 0;

  if (games.isLoading) return <Loading />;
  if (games.error) return <ErrorNote error={games.error} onRetry={() => games.refetch()} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, gap: space.md }}>
        <Field label="Search your library" value={text} onChangeText={setText} autoCorrect={false} placeholder="Title" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip label="All" selected={status === "all"} onPress={() => setStatus("all")} />
          {STATUS_ORDER.map((s) => (
            <Chip key={s} label={STATUS[s].label} selected={status === s} onPress={() => setStatus(s)} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T size="sm" tone="muted" accessibilityLiveRegion="polite">
            {list.length === total ? `${total} ${total === 1 ? "game" : "games"}` : `${list.length} of ${total} games`}
          </T>
          <View style={{ flexDirection: "row", gap: space.sm }}>
            {SORTS.map((s) => (
              <Chip key={s.key} label={s.label} selected={sort === s.key} onPress={() => setSort(s.key)} />
            ))}
          </View>
        </View>
      </View>
      <FlatList<Game>
        data={list}
        keyExtractor={(g) => g._id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border, marginVertical: space.sm }} />}
        ListEmptyComponent={<Empty icon="filter" title="No games match" body="Try another status or search." />}
        renderItem={({ item }) => (
          <Row accessibilityRole="button" accessibilityLabel={item.title} onPress={() => router.push({ pathname: "/game/[id]", params: { id: item._id } })}>
            <Cover uri={item.imageURL} title={item.title} width={44} height={58} />
            <View style={{ flex: 1, gap: 4 }}>
              <T weight="600" numberOfLines={1}>
                {item.title}
              </T>
              <StatusPill status={item.progressStatus} />
            </View>
            {typeof item.rating === "number" ? (
              <T tone="muted" size="sm">
                {item.rating}/10
              </T>
            ) : null}
          </Row>
        )}
      />
    </View>
  );
}
