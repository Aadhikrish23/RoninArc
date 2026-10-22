import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useAddNote,
  useCollections,
  useCreateCollection,
  useDeleteNote,
  useDeleteReview,
  useGame,
  useNotes,
  useRemoveGame,
  useReview,
  useSaveReview,
  useSetStatus,
  useToggleInCollection,
} from "@/data/hooks";
import { Button, Card, Chip, Cover, ErrorNote, Field, Heading, Loading, Screen, SectionTitle, T } from "@/ui/components";
import { radius, space, STATUS, STATUS_ORDER, useColors, useStatusColor, type ProgressStatus } from "@/ui/theme";

const plain = (html?: string) =>
  (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

function StatusButton({ status, selected, onPress }: { status: ProgressStatus; selected: boolean; onPress: () => void }) {
  const color = useStatusColor(status);
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ flexGrow: 1, minHeight: 40, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: selected ? color : c.border, backgroundColor: selected ? `${color}22` : "transparent" }}
    >
      <T size="sm" weight="600" style={{ color: selected ? color : c.muted }}>
        {STATUS[status].label}
      </T>
    </Pressable>
  );
}

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = useGame(id);
  const review = useReview(id);
  const notes = useNotes(id);
  const collections = useCollections();
  const setStatus = useSetStatus();
  const saveReview = useSaveReview();
  const deleteReview = useDeleteReview();
  const addNote = useAddNote();
  const deleteNote = useDeleteNote();
  const toggle = useToggleInCollection();
  const createCollection = useCreateCollection();
  const removeGame = useRemoveGame();
  const c = useColors();

  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [noteText, setNoteText] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    if (review.data) {
      setRating(review.data.rating ?? null);
      setReviewText(review.data.reviewText ?? "");
    }
  }, [review.data]);

  if (game.isLoading) return <Loading />;
  if (game.error || !game.data) return <ErrorNote error={game.error ?? new Error("This game isn't in your library any more.")} onRetry={() => game.refetch()} />;
  const g = game.data;
  const about = plain(g.description);
  const year = (g as any).released ? String((g as any).released).slice(0, 4) : null;
  const inCollections = (collections.data ?? []).filter((col) => col.gameIds.some((x) => (typeof x === "string" ? x : x._id) === g._id));

  const fail = (e: unknown) => setMessage(e instanceof Error ? e.message : "That didn't work.");

  const confirmRemove = () => {
    const lost = [review.data ? "review" : null, (notes.data?.length ?? 0) > 0 ? "notes" : null].filter(Boolean).join(" and ");
    Alert.alert(`Remove ${g.title}?`, lost ? `Its ${lost} will be deleted too.` : "You can add it back any time.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removeGame
            .mutateAsync(g._id)
            .then(() => router.back())
            .catch(fail),
      },
    ]);
  };

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: g.title }} />
      <View style={{ flexDirection: "row", gap: space.lg }}>
        <Cover uri={g.imageURL} title={g.title} width={110} height={146} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Heading>{g.title}</Heading>
          <T tone="muted" size="sm">
            {[year, g.developer, g.tags?.slice(0, 2).join(", ")].filter(Boolean).join(" · ")}
          </T>
          {typeof g.rating === "number" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: space.xs }}>
              <Feather name="star" size={14} color={c.accent} />
              <T weight="600">{g.rating}/10</T>
            </View>
          ) : null}
        </View>
      </View>

      {message ? (
        <T tone="danger" size="sm" style={{ marginTop: space.md }} accessibilityLiveRegion="polite">
          {message}
        </T>
      ) : null}

      <SectionTitle title="Status" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }} accessibilityRole="radiogroup">
        {STATUS_ORDER.map((s) => (
          <StatusButton key={s} status={s} selected={g.progressStatus === s} onPress={() => setStatus.mutateAsync({ id: g._id, status: s }).catch(fail)} />
        ))}
      </View>

      <SectionTitle title="Your rating" />
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <Chip key={n} label={String(n)} selected={rating === n} onPress={() => setRating(n)} />
          ))}
        </View>
        <Field label="Review (optional)" value={reviewText} onChangeText={setReviewText} multiline style={{ minHeight: 80, textAlignVertical: "top", paddingTop: space.sm }} placeholder="What did you think?" />
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button
            title={review.data ? "Save changes" : "Save rating"}
            disabled={!rating}
            loading={saveReview.isPending}
            onPress={() => saveReview.mutateAsync({ gameId: g._id, rating: rating!, reviewText: reviewText.trim() }).then(() => setMessage(null)).catch(fail)}
            style={{ flex: 1 }}
          />
          {review.data ? <Button title="Delete" variant="ghost" onPress={() => deleteReview.mutateAsync(g._id).then(() => (setRating(null), setReviewText(""))).catch(fail)} /> : null}
        </View>
      </Card>

      <SectionTitle title="Notes" />
      <Card style={{ gap: space.md }}>
        {(notes.data ?? []).length === 0 ? (
          <T tone="muted" size="sm">
            Nothing yet. Boss strategies, where you left off, builds to try.
          </T>
        ) : (
          (notes.data ?? []).map((n) => (
            <View key={n._id} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T>{n.content}</T>
                <T size="xs" tone="faint">
                  {new Date(n.createdAt ?? Date.now()).toLocaleDateString()}
                </T>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Delete note" hitSlop={10} onPress={() => deleteNote.mutateAsync(n._id).catch(fail)}>
                <Feather name="trash-2" size={18} color={c.faint} />
              </Pressable>
            </View>
          ))
        )}
        <Field label="Add a note" value={noteText} onChangeText={setNoteText} multiline placeholder="e.g. beat Meg with the bow" />
        <Button title="Add note" variant="outline" disabled={!noteText.trim()} loading={addNote.isPending} onPress={() => addNote.mutateAsync({ gameId: g._id, content: noteText.trim() }).then(() => setNoteText("")).catch(fail)} />
      </Card>

      <SectionTitle title="Collections" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {(collections.data ?? []).map((col) => {
          const inIt = inCollections.some((x) => x._id === col._id);
          return <Chip key={col._id} label={col.name} selected={inIt} onPress={() => toggle.mutateAsync({ collectionId: col._id, gameId: g._id, add: !inIt }).catch(fail)} />;
        })}
      </View>
      <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end", marginTop: space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="New collection" value={newCollection} onChangeText={setNewCollection} placeholder="e.g. Soulslikes" />
        </View>
        <Button
          title="Create"
          variant="outline"
          disabled={!newCollection.trim()}
          loading={createCollection.isPending}
          onPress={async () => {
            try {
              const col = await createCollection.mutateAsync(newCollection.trim());
              await toggle.mutateAsync({ collectionId: col._id, gameId: g._id, add: true });
              setNewCollection("");
            } catch (e) {
              fail(e);
            }
          }}
        />
      </View>

      {about ? (
        <>
          <SectionTitle title="About" />
          <T tone="muted" numberOfLines={showAbout ? undefined : 6}>
            {about}
          </T>
          <Button title={showAbout ? "Show less" : "Read more"} variant="ghost" onPress={() => setShowAbout((v) => !v)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
        </>
      ) : null}

      <View style={{ marginTop: space.xxl }}>
        <Button title="Remove from library" variant="danger" icon="trash-2" onPress={confirmRemove} loading={removeGame.isPending} />
      </View>
    </Screen>
  );
}
