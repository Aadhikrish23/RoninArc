import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useDashboard, useInvalidateLibrary, formatMinutes } from "@/data/hooks";
import { Button, Cover, ErrorNote, Loading, PageHeader, Panel, Screen, T } from "@/ui/components";
import { radius, space, STATUS, STATUS_ORDER, useColors, useStatusColor, type ProgressStatus } from "@/ui/theme";

function StatusCount({ status, count }: { status: ProgressStatus; count: number }) {
  const color = useStatusColor(status);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minWidth: "45%" }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <T size="sm">
        {STATUS[status].label}  <T size="sm" weight="700">{count}</T>
      </T>
    </View>
  );
}

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

/** The desktop's activity icons: status changes, ratings, collections, additions. */
function activityIcon(type: string): keyof typeof Feather.glyphMap {
  if (/RATED|REVIEW/i.test(type)) return "star";
  if (/COLLECTION/i.test(type)) return "folder-plus";
  if (/ADDED/i.test(type)) return "plus-circle";
  if (/REMOVED/i.test(type)) return "minus-circle";
  if (/NOTE/i.test(type)) return "edit-3";
  return "check-circle";
}

const openGame = (id: string) => router.push({ pathname: "/game/[id]", params: { id } });

export default function Dashboard() {
  const dash = useDashboard();
  const invalidate = useInvalidateLibrary();
  const [refreshing, setRefreshing] = useState(false);
  const c = useColors();

  const refresh = async () => {
    setRefreshing(true);
    await invalidate();
    setRefreshing(false);
  };

  if (dash.isLoading) return <Loading />;
  if (dash.error || !dash.data) return <ErrorNote error={dash.error} onRetry={() => dash.refetch()} />;
  const { backlog, playtime, continuePlaying, recentActivity } = dash.data;
  const by = backlog.byStatus;
  const finishedOf = by.plan + by.playing + by.paused + by.completed;
  const pct = finishedOf ? Math.round((by.completed / finishedOf) * 100) : 0;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} />}>
      <PageHeader title="Dashboard" subtitle="What you're playing, how much, and what's waiting." />

      {continuePlaying.length > 0 && (
        <Panel
          icon="play"
          title="Pick up where you left off"
          action={
            <Pressable accessibilityRole="link" onPress={() => router.push("/")} hitSlop={8}>
              <T size="sm" weight="600" tone="accent">
                Library
              </T>
            </Pressable>
          }
        >
          {continuePlaying.map((row) => (
            <View key={row.game._id} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Cover uri={row.game.imageURL} title={row.game.title} width={44} height={58} rounded={radius.sm} />
              <View style={{ flex: 1, gap: 2 }}>
                <T weight="600" numberOfLines={1}>
                  {row.game.title}
                </T>
                <T size="xs" tone="muted" numberOfLines={2}>
                  {row.game.progressStatus === "paused" ? "Paused" : "In progress"} ·{" "}
                  {row.lastPlayed ? `last played ${ago(row.lastPlayed)}` : "no play sessions recorded yet"}
                  {row.minutesPlayed ? ` · ${formatMinutes(row.minutesPlayed)}` : ""}
                </T>
              </View>
              <Button title="Open" variant="accent" size="sm" accessibilityLabel={`Open ${row.game.title}`} onPress={() => openGame(row.game._id)} />
            </View>
          ))}
        </Panel>
      )}

      <Panel icon="clock" title="Playtime">
        {playtime.totalMinutes > 0 ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[
              ["Last 7 days", playtime.last7DaysMinutes],
              ["Last 30 days", playtime.last30DaysMinutes],
              ["All time", playtime.totalMinutes],
            ].map(([label, min]) => (
              <View key={String(label)} style={{ gap: 2 }}>
                <T size="xl" weight="700">
                  {formatMinutes(Number(min))}
                </T>
                <T size="xs" tone="muted">
                  {label}
                </T>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: space.xs }}>
            <T size="xl" weight="700">
              No playtime yet
            </T>
            <T size="sm" tone="muted">
              Playtime is tracked when you launch games from the RoninArc desktop app.
            </T>
          </View>
        )}
      </Panel>

      <Panel icon="bookmark" title="Backlog progress">
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.sm }}>
          <T>
            <T size="xl" weight="700">
              {backlog.size}
            </T>{" "}
            games in your backlog
          </T>
          <T size="xs" tone="muted">
            {backlog.completedThisYear} finished this year
          </T>
        </View>
        <T size="xs" tone="muted" style={{ marginTop: -space.sm }}>
          {`${by.completed} of ${finishedOf} finished. Dropped games don't count.`}
        </T>
        <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: c.cardAlt, overflow: "hidden" }} accessibilityLabel={`${pct} percent finished`}>
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: c.progress, borderRadius: radius.pill }} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space.sm }}>
          {STATUS_ORDER.map((s) => (
            <StatusCount key={s} status={s} count={by[s]} />
          ))}
        </View>
        {backlog.untouched.length > 0 && (
          <View style={{ gap: space.sm, marginTop: space.xs }}>
            <T size="sm" weight="600">
              Planned, not started yet ({backlog.untouchedCount})
            </T>
            {backlog.untouched.slice(0, 5).map((u) => (
              <Pressable key={u.game._id} accessibilityRole="button" accessibilityLabel={u.game.title} onPress={() => openGame(u.game._id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.md, opacity: pressed ? 0.7 : 1 })}>
                <Cover uri={u.game.imageURL} title={u.game.title} width={32} height={40} rounded={4} />
                <T size="sm" style={{ flex: 1 }} numberOfLines={1}>
                  {u.game.title}
                </T>
                <T size="xs" tone="muted">
                  planned {ago(u.plannedAt)}
                </T>
              </Pressable>
            ))}
          </View>
        )}
      </Panel>

      {recentActivity.length > 0 && (
        <Panel icon="activity" title="Recent activity">
          {recentActivity.map((a) => (
            <View key={a._id} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
              <Feather name={activityIcon(a.type)} size={15} color={c.accent} />
              <T size="sm" style={{ flex: 1 }} numberOfLines={2}>
                {a.message}
              </T>
              <T size="xs" tone="muted">
                {ago(a.createdAt)}
              </T>
            </View>
          ))}
        </Panel>
      )}
    </Screen>
  );
}
