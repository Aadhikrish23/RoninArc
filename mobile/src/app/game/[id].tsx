import { useState } from "react";
import { Alert, Pressable, View, useWindowDimensions } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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
import { Button, Card, ErrorNote, Field, Loading, Panel, RatingLine, Screen, SectionTitle, T, Tag } from "@/ui/components";
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
      accessibilityLabel={STATUS[status].label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ minHeight: 34, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 1, borderColor: selected ? color : c.border, backgroundColor: selected ? `${color}1F` : c.card }}
    >
      <T size="sm" weight="600" style={{ color: selected ? color : c.muted }}>
        {STATUS[status].label}
      </T>
    </Pressable>
  );
}

/** 1-10 as small square Chakra buttons; the chosen one is solid purple. */
function RatingPicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const on = value === n;
        return (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`Rate ${n} out of 10`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(n)}
            style={{ width: 36, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? c.accentFill : c.border, backgroundColor: on ? c.accentFill : c.card }}
          >
            <T size="sm" weight="600" style={{ color: on ? c.onAccentFill : c.text }}>
              {n}
            </T>
          </Pressable>
        );
      })}
    </View>
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
  const { width } = useWindowDimensions();

  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [editingReview, setEditingReview] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  // The form starts from the saved review whenever a new one loads (adjusted during render, not in an effect).
  const [formFor, setFormFor] = useState<unknown>(null);
  if (review.data && formFor !== review.data) {
    setFormFor(review.data);
    setRating(review.data.rating ?? null);
    setReviewText(review.data.reviewText ?? "");
  }

  if (game.isLoading) return <Loading />;
  if (game.error || !game.data) return <ErrorNote error={game.error ?? new Error("This game isn't in your library any more.")} onRetry={() => game.refetch()} />;
  const g = game.data;
  const about = plain(g.description);
  // The single-game endpoint has no rating; the review does.
  const shownRating = review.data?.rating ?? g.rating;
  const year = (g as any).released ? String((g as any).released).slice(0, 4) : null;
  const inCollections = (collections.data ?? []).filter((col) => col.gameIds.some((x) => (typeof x === "string" ? x : x._id) === g._id));
  const otherCollections = (collections.data ?? []).filter((col) => !inCollections.some((x) => x._id === col._id));
  const bannerHeight = Math.round(Math.min(width, 640) * 0.62);

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

  const showReviewForm = editingReview || !review.data;

  return (
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: "" }} />

      {/* The desktop's hero: the cover wide, title and facts over a dark fade. */}
      <View style={{ height: bannerHeight, borderRadius: radius.lg, overflow: "hidden", backgroundColor: c.cardAlt }}>
        {g.imageURL ? <Image source={{ uri: g.imageURL }} style={{ position: "absolute", inset: 0 } as any} contentFit="cover" transition={150} accessibilityIgnoresInvertColors /> : null}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.85)"]} locations={[0.35, 1]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        <View style={{ position: "absolute", left: space.lg, right: space.lg, bottom: space.lg, gap: 4 }}>
          <T size="xxl" weight="700" accessibilityRole="header" style={{ color: "#FFFFFF", letterSpacing: -0.4 }} numberOfLines={2}>
            {g.title}
          </T>
          <T size="sm" style={{ color: "rgba(255,255,255,0.85)" }} numberOfLines={1}>
            {[year, g.developer, g.tags?.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
          </T>
        </View>
      </View>

      {message ? (
        <T tone="danger" size="sm" style={{ marginTop: space.md }} accessibilityLiveRegion="polite">
          {message}
        </T>
      ) : null}

      <Panel title="Your library">
        <View style={{ gap: space.sm }}>
          <T size="sm" weight="600">
            Status
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }} accessibilityRole="radiogroup">
            {STATUS_ORDER.map((s) => (
              <StatusButton key={s} status={s} selected={g.progressStatus === s} onPress={() => setStatus.mutateAsync({ id: g._id, status: s }).catch(fail)} />
            ))}
          </View>
        </View>

        {/* "Your review", in its own tinted box as on the desktop. */}
        <View style={{ gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
          <T weight="700">Your review</T>
          {!showReviewForm && review.data ? (
            <View style={{ gap: space.sm }}>
              {typeof shownRating === "number" ? <RatingLine rating={shownRating} /> : null}
              {review.data.reviewText ? <T size="sm">{review.data.reviewText}</T> : null}
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button title="Edit review" size="sm" variant="accent" onPress={() => setEditingReview(true)} />
                <Button title="Delete" size="sm" variant="ghost" onPress={() => deleteReview.mutateAsync(g._id).then(() => (setRating(null), setReviewText(""))).catch(fail)} />
              </View>
            </View>
          ) : (
            <>
              <RatingPicker value={rating} onChange={setRating} />
              <Field label="Review (optional)" value={reviewText} onChangeText={setReviewText} multiline style={{ minHeight: 80, textAlignVertical: "top", paddingTop: space.sm }} placeholder="What did you think?" />
              <View style={{ flexDirection: "row", gap: space.sm }}>
                <Button
                  title={review.data ? "Save changes" : "Write review"}
                  size="sm"
                  disabled={!rating}
                  loading={saveReview.isPending}
                  onPress={() =>
                    saveReview
                      .mutateAsync({ gameId: g._id, rating: rating!, reviewText: reviewText.trim() })
                      .then(() => (setMessage(null), setEditingReview(false)))
                      .catch(fail)
                  }
                />
                {editingReview ? <Button title="Cancel" size="sm" variant="ghost" onPress={() => setEditingReview(false)} /> : null}
              </View>
            </>
          )}
        </View>

        <View style={{ gap: space.sm }}>
          <T size="sm" weight="600">
            Collections ({inCollections.length})
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {inCollections.map((col) => (
              <Pressable
                key={col._id}
                accessibilityRole="button"
                accessibilityLabel={`Remove from ${col.name}`}
                onPress={() => toggle.mutateAsync({ collectionId: col._id, gameId: g._id, add: false }).catch(fail)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, backgroundColor: c.accentSoft, paddingHorizontal: 10, paddingVertical: 4 }}
              >
                <T size="xs" weight="600" tone="accent">
                  {col.name}
                </T>
                <Feather name="x" size={12} color={c.accent} />
              </Pressable>
            ))}
            {otherCollections.map((col) => (
              <Pressable
                key={col._id}
                accessibilityRole="button"
                accessibilityLabel={`Add to ${col.name}`}
                onPress={() => toggle.mutateAsync({ collectionId: col._id, gameId: g._id, add: true }).catch(fail)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 3 }}
              >
                <Feather name="plus" size={12} color={c.muted} />
                <T size="xs" weight="600" tone="muted">
                  {col.name}
                </T>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}>
              <Field label="New collection" value={newCollection} onChangeText={setNewCollection} placeholder="e.g. Soulslikes" />
            </View>
            <Button
              title="Add to collection"
              variant="accent"
              size="sm"
              disabled={!newCollection.trim()}
              loading={createCollection.isPending}
              style={{ minHeight: 46 }}
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
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: space.md, alignItems: "flex-end" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${g.title} from library`} onPress={confirmRemove} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Feather name="trash-2" size={14} color={c.danger} />
            <T size="sm" weight="600" tone="danger">
              Remove from library
            </T>
          </Pressable>
        </View>
      </Panel>

      <SectionTitle title="Notes" />
      <View style={{ gap: space.sm }}>
        <Field label="Add a note" value={noteText} onChangeText={setNoteText} multiline placeholder="Jot down a strategy, reminder, or anything else about this game…" style={{ minHeight: 64, textAlignVertical: "top", paddingTop: space.sm }} />
        <Button title="Add note" size="sm" disabled={!noteText.trim()} loading={addNote.isPending} style={{ alignSelf: "flex-end" }} onPress={() => addNote.mutateAsync({ gameId: g._id, content: noteText.trim() }).then(() => setNoteText("")).catch(fail)} />
        {(notes.data ?? []).length === 0 ? (
          <T tone="muted" size="sm">
            No notes yet.
          </T>
        ) : (
          (notes.data ?? []).map((n) => (
            <Card key={n._id} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start", padding: space.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T>{n.content}</T>
                <T size="xs" tone="faint">
                  {n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ""}
                </T>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Delete note" hitSlop={10} onPress={() => deleteNote.mutateAsync(n._id).catch(fail)}>
                <Feather name="trash-2" size={16} color={c.faint} />
              </Pressable>
            </Card>
          ))
        )}
      </View>

      {about ? (
        <>
          <SectionTitle title="About" />
          <T tone="muted" style={{ lineHeight: 22 }} numberOfLines={showAbout ? undefined : 6}>
            {about}
          </T>
          <Button title={showAbout ? "Show less" : "Read more"} variant="ghost" size="sm" onPress={() => setShowAbout((v) => !v)} style={{ alignSelf: "flex-start", paddingHorizontal: 0 }} />
        </>
      ) : null}

      {(g.tags ?? []).length > 0 ? (
        <>
          <SectionTitle title="Genres" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(g.tags ?? []).map((t) => (
              <Tag key={t} label={t} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
