import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { RawgResult } from "@/api/client";
import { useAddGame, useRawgSearch } from "@/data/hooks";
import { Button, Card, Cover, Empty, Field, Loading, T } from "@/ui/components";
import { space, useColors } from "@/ui/theme";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function AddGame() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? "");
  const query = useDebounced(text.trim(), 350);
  const search = useRawgSearch(query);
  const add = useAddGame();
  const [added, setAdded] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const c = useColors();

  // Owned matches come back as library games ("title", "_id"), not RAWG results ("name", "id").
  const results: (RawgResult & { ownedId?: string })[] = [
    ...(search.data?.owned ?? []).map((g: any) => ({ id: g.rawgId ?? g._id, name: g.title, imageURL: g.imageURL, genres: g.tags ?? [], released: g.released ?? null, ownedId: g._id })),
    ...(search.data?.discover ?? []),
  ];

  const onAdd = async (r: RawgResult) => {
    setError(null);
    try {
      const game: any = await add.mutateAsync(r);
      setAdded((m) => ({ ...m, [r.id]: game?._id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add it.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: space.lg, gap: space.sm }}>
        <Field label="Search games" hideLabel placeholder="Search games… e.g. hollow knight, rdr 2, ds3" value={text} onChangeText={setText} autoFocus autoCorrect={false} returnKeyType="search" />
        {error ? (
          <T tone="danger" size="sm">
            {error}
          </T>
        ) : null}
      </View>
      {query.length < 2 ? (
        <Empty icon="search" title="Search for a game you own" body="Typos and short names like gta 5 or botw work too." />
      ) : search.isLoading ? (
        <Loading />
      ) : search.error ? (
        <Empty icon="wifi-off" title="Search isn't working right now" body={(search.error as Error).message} />
      ) : results.length === 0 ? (
        <Empty icon="search" title={`No games found for "${query}"`} body="Check the spelling, or try the game's full name." />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl }}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const openId = item.ownedId ?? added[item.id];
            return (
              <Card accessibilityLabel={item.name} style={{ flexDirection: "row", alignItems: "center", gap: space.md, padding: space.sm, paddingRight: space.md }}>
                <Cover uri={item.imageURL ?? undefined} title={item.name} width={48} height={64} rounded={6} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="700" numberOfLines={2}>
                    {item.name}
                  </T>
                  <T size="xs" tone="muted" numberOfLines={1}>
                    {[item.released?.slice(0, 4), item.genres?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
                  </T>
                </View>
                {openId ? (
                  <Button title="Open" size="sm" variant="accent" accessibilityLabel={`Open ${item.name}, in your library`} onPress={() => router.replace({ pathname: "/game/[id]", params: { id: openId } })} />
                ) : (
                  <Button title="Add" size="sm" icon="plus" onPress={() => onAdd(item)} loading={add.isPending && add.variables?.id === item.id} accessibilityLabel={`Add ${item.name}`} />
                )}
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
