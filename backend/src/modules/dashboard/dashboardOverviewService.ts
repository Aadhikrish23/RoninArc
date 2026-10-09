import { Types } from "mongoose";

import LibraryGame from "../library/LibraryGame";
import PlaySession from "../playSession/PlaySessionModel";
import Activity from "../activity/ActivityModel";

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUSES = ["none", "plan", "playing", "paused", "completed", "dropped"] as const;

/** Just what a dashboard row needs to show and link to a game. */
export interface GameSummary {
  _id: string;
  title: string;
  imageURL: string | null;
  rawgId: number | null;
  progressStatus: string;
}

export interface DashboardOverview {
  continuePlaying: { game: GameSummary; lastPlayed: string | null; minutesPlayed: number }[];
  playtime: {
    last7DaysMinutes: number;
    last30DaysMinutes: number;
    totalMinutes: number;
    sessionsLast7Days: number;
    /** Oldest first, always 7 entries ending today (local server date). */
    daily: { date: string; minutes: number }[];
    mostPlayed: { game: GameSummary; minutesPlayed: number }[];
  };
  backlog: {
    total: number;
    byStatus: Record<(typeof STATUSES)[number], number>;
    completedThisYear: number;
    untouchedCount: number;
    /** Planned or unstarted games with no play session yet, longest-waiting first. */
    untouched: { game: GameSummary; addedAt: string }[];
  };
  recentActivity: { _id: string; type: string; message: string; createdAt: string; game: GameSummary | null }[];
}

// Queries here use .lean(), which skips the model's `imageURL` virtual, so
// resolve the selected artwork the same way the virtual does.
const coverOf = (g: any): string | null => g.imageURL || g.artwork?.sources?.[g.artwork?.selectedSource] || null;

const summarize = (g: any): GameSummary => ({
  _id: String(g._id),
  title: g.title,
  imageURL: coverOf(g),
  rawgId: g.rawgId ?? null,
  progressStatus: g.progressStatus || "none",
});

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const getOverview = async (userId: string, now = new Date()): Promise<DashboardOverview> => {
  const uid = new Types.ObjectId(userId);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [games, sessions, completions, activities] = await Promise.all([
    LibraryGame.find({ userId: uid }).lean(),
    PlaySession.find({ userId: uid }).lean(),
    Activity.find({ userId: uid, type: "STATUS_CHANGED", message: / marked as completed$/, createdAt: { $gte: yearStart } })
      .select("gameId")
      .lean(),
    Activity.find({ userId: uid }).sort({ createdAt: -1 }).limit(10).populate("gameId").lean(),
  ]);

  // Per-game playtime and last session, from play sessions.
  const perGame = new Map<string, { minutes: number; lastPlayed: Date | null }>();
  for (const s of sessions) {
    const key = String(s.gameId);
    const entry = perGame.get(key) ?? { minutes: 0, lastPlayed: null };
    entry.minutes += s.durationMinutes || 0;
    if (!entry.lastPlayed || s.startedAt > entry.lastPlayed) entry.lastPlayed = s.startedAt;
    perGame.set(key, entry);
  }
  const gamesById = new Map(games.map((g) => [String(g._id), g]));

  const continuePlaying = games
    .filter((g) => g.progressStatus === "playing")
    .map((g) => {
      const stats = perGame.get(String(g._id));
      return { game: summarize(g), lastPlayed: stats?.lastPlayed ?? null, minutesPlayed: stats?.minutes ?? 0 };
    })
    .sort((a, b) => (b.lastPlayed?.getTime() ?? 0) - (a.lastPlayed?.getTime() ?? 0))
    .slice(0, 6)
    .map((row) => ({ ...row, lastPlayed: row.lastPlayed ? row.lastPlayed.toISOString() : null }));

  // Playtime windows.
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return { date: dayKey(d), minutes: 0 };
  });
  const dailyIndex = new Map(daily.map((d, i) => [d.date, i]));
  let last7DaysMinutes = 0;
  let last30DaysMinutes = 0;
  let sessionsLast7Days = 0;
  let totalMinutes = 0;
  for (const s of sessions) {
    const minutes = s.durationMinutes || 0;
    totalMinutes += minutes;
    if (s.startedAt >= monthAgo) last30DaysMinutes += minutes;
    if (s.startedAt >= weekAgo) {
      last7DaysMinutes += minutes;
      sessionsLast7Days += 1;
    }
    const idx = dailyIndex.get(dayKey(s.startedAt));
    if (idx !== undefined) daily[idx].minutes += minutes;
  }
  const mostPlayed = [...perGame.entries()]
    .filter(([id, v]) => v.minutes > 0 && gamesById.has(id))
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 5)
    .map(([id, v]) => ({ game: summarize(gamesById.get(id)), minutesPlayed: v.minutes }));

  // Backlog.
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as DashboardOverview["backlog"]["byStatus"];
  for (const g of games) {
    const status = (STATUSES as readonly string[]).includes(g.progressStatus) ? g.progressStatus : "none";
    byStatus[status as keyof typeof byStatus] += 1;
  }
  const completedIds = new Set(
    completions
      .map((a) => (a.gameId ? String(a.gameId) : null))
      .filter((id): id is string => !!id && gamesById.get(id)?.progressStatus === "completed"),
  );
  const untouchedAll = games
    .filter((g) => (g.progressStatus === "plan" || !g.progressStatus || g.progressStatus === "none") && !perGame.has(String(g._id)))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const recentActivity = activities.map((a: any) => ({
    _id: String(a._id),
    type: a.type,
    message: a.message,
    createdAt: new Date(a.createdAt).toISOString(),
    game: a.gameId && typeof a.gameId === "object" && a.gameId.title ? summarize(a.gameId) : null,
  }));

  return {
    continuePlaying,
    playtime: { last7DaysMinutes, last30DaysMinutes, totalMinutes, sessionsLast7Days, daily, mostPlayed },
    backlog: {
      total: games.length,
      byStatus,
      completedThisYear: completedIds.size,
      untouchedCount: untouchedAll.length,
      untouched: untouchedAll.slice(0, 5).map((g) => ({ game: summarize(g), addedAt: new Date(g.createdAt).toISOString() })),
    },
    recentActivity,
  };
};

export default { getOverview };
