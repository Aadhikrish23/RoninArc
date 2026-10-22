import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { useDashboard, useInvalidateLibrary, formatMinutes } from "@/data/hooks";
import { Card, Cover, ErrorNote, Heading, Loading, Row, Screen, SectionTitle, StatusPill, T } from "@/ui/components";
import { radius, space, STATUS, STATUS_ORDER, useColors, useStatusColor, type ProgressStatus } from "@/ui/theme";

function StatusCount({ status, count }: { status: ProgressStatus; count: number }) {
  const color = useStatusColor(status);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minWidth: "45%" }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <T size="sm">
        {STATUS[status].label} <T size="sm" weight="700">{count}</T>
      </T>
    </View>
  );
}

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

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
      <Heading>Dashboard</Heading>

      <SectionTitle title="Backlog progress" />
      <Card style={{ gap: space.md }}>
        <T>
          <T weight="700">{by.completed}</T> of {finishedOf} finished. Dropped games don't count.
        </T>
        <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: c.cardAlt, overflow: "hidden" }} accessibilityLabel={`${pct} percent finished`}>
          <View style={{ width: `${pct}%`, height: "100%", backgroundColor: c.accent }} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space.sm }}>
          {STATUS_ORDER.map((s) => (
            <StatusCount key={s} status={s} count={by[s]} />
          ))}
        </View>
      </Card>

      {continuePlaying.length > 0 && (
        <>
          <SectionTitle title="Pick up where you left off" />
          <Card style={{ gap: space.md }}>
            {continuePlaying.map((row) => (
              <Row key={row.game._id} accessibilityRole="button" accessibilityLabel={row.game.title} onPress={() => router.push({ pathname: "/game/[id]", params: { id: row.game._id } })}>
                <Cover uri={row.game.imageURL} title={row.game.title} width={40} height={52} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="600" numberOfLines={1}>
                    {row.game.title}
                  </T>
                  <T size="xs" tone="muted">
                    {row.lastPlayed ? `Last played ${ago(row.lastPlayed)}` : "Not launched from RoninArc yet"}
                    {row.minutesPlayed ? ` · ${formatMinutes(row.minutesPlayed)}` : ""}
                  </T>
                </View>
                <StatusPill status={row.game.progressStatus} />
              </Row>
            ))}
          </Card>
        </>
      )}

      {playtime.totalMinutes > 0 && (
        <>
          <SectionTitle title="Playtime" />
          <Card style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[
              ["Last 7 days", playtime.last7DaysMinutes],
              ["Last 30 days", playtime.last30DaysMinutes],
              ["All time", playtime.totalMinutes],
            ].map(([label, min]) => (
              <View key={String(label)} style={{ gap: 2 }}>
                <T size="lg" weight="700">
                  {formatMinutes(Number(min))}
                </T>
                <T size="xs" tone="muted">
                  {label}
                </T>
              </View>
            ))}
          </Card>
          <T size="xs" tone="faint" style={{ marginTop: space.xs }}>
            Counted when you launch games from RoninArc on your PC.
          </T>
        </>
      )}

      {recentActivity.length > 0 && (
        <>
          <SectionTitle title="Recent activity" />
          <Card style={{ gap: space.md }}>
            {recentActivity.map((a) => (
              <View key={a._id} style={{ gap: 2 }}>
                <T size="sm">{a.message}</T>
                <T size="xs" tone="faint">
                  {ago(a.createdAt)}
                </T>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
