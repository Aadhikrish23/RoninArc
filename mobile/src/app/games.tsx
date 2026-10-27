import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useGames } from "@/data/hooks";
import { Chip, Empty, ErrorNote, Field, Loading, PageHeader, Screen, T } from "@/ui/components";
import { GameGrid } from "@/ui/GameTile";
import { STATUS, STATUS_ORDER, space, type ProgressStatus } from "@/ui/theme";

type Sort = "title" | "newest" | "rating";
const SORTS: { key: Sort; label: string }[] = [
  { key: "title", label: "Title (A-Z)" },
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

  return (
    <Screen>
      <PageHeader
        title="All Games"
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        right={
          <T size="sm" tone="muted" style={{ paddingTop: 10 }} accessibilityLiveRegion="polite">
            {list.length === total ? `${total} ${total === 1 ? "game" : "games"}` : `${list.length} of ${total}`}
          </T>
        }
      />
      {games.isLoading ? (
        <Loading />
      ) : games.error ? (
        <ErrorNote error={games.error} onRetry={() => games.refetch()} />
      ) : (
        <>
          <View style={{ gap: space.md, marginTop: space.md, marginBottom: space.lg }}>
            <Field label="Search library" hideLabel value={text} onChangeText={setText} autoCorrect={false} placeholder="Search library…" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              <Chip label="All statuses" selected={status === "all"} onPress={() => setStatus("all")} />
              {STATUS_ORDER.map((s) => (
                <Chip key={s} label={STATUS[s].label} selected={status === s} onPress={() => setStatus(s)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {SORTS.map((s) => (
                <Chip key={s.key} label={s.label} selected={sort === s.key} onPress={() => setSort(s.key)} />
              ))}
            </ScrollView>
          </View>
          {list.length === 0 ? <Empty icon="filter" title="No games match" body="Try another status or search." /> : <GameGrid games={list} />}
        </>
      )}
    </Screen>
  );
}
