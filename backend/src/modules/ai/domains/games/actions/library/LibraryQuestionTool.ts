import { Types } from "mongoose";
import { BaseTool } from "../../../../sdk/BaseTool";
import { AIToolContext } from "../../../../sdk/AIToolContext";
import { AIToolResult } from "../../../../sdk/AIToolResult";
import LibraryGame from "../../../../../library/LibraryGame";
import Review from "../../../../../review/Reviewmodel";
import Note from "../../../../../notes/Notemodel";
import { namedTitles } from "../../conversation/TargetGrounding";

interface LibraryQuestionInput {
  question?: string;
}

const STATUS_LABEL: Record<string, string> = {
  plan: "Plan to Play",
  playing: "Playing",
  paused: "Paused",
  completed: "Completed",
  dropped: "Dropped",
  none: "No status",
};

const LIST_LIMIT = 25;

/** "A, B and C", or "A, B, … and 7 more". */
function listTitles(titles: string[]): string {
  if (titles.length === 0) return "";
  const shown = titles.slice(0, LIST_LIMIT);
  const extra = titles.length - shown.length;
  if (extra > 0) return `${shown.join(", ")} and ${extra} more`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Answers questions about the user's own library from the database:
 * backlog, counts, what's being played, finished, recently added, top rated.
 */
export class LibraryQuestionTool extends BaseTool<LibraryQuestionInput, any> {
  readonly category = "library";

  readonly name = "library_question";

  readonly description = "Answers questions about the user's library: backlog, counts, statuses, recent additions, top rated.";

  async execute(input: LibraryQuestionInput, context: AIToolContext): Promise<AIToolResult<any>> {
    const q = (input.question || "").toLowerCase();
    const uid = new Types.ObjectId(context.userId);
    const games = await LibraryGame.find({ userId: uid }).sort({ createdAt: -1 }).select("title progressStatus createdAt").lean();

    if (games.length === 0) {
      return this.success({ total: 0 }, "Your library is empty so far. Tell me a game to add, like \"add Hades\".");
    }

    // A question about one game ("what did I rate witcher 3?", "is celeste finished?"):
    // answer it from the library, never by changing anything.
    const bestTitle = namedTitles(q, games.map((g: any) => g.title as string))[0];
    const named = (bestTitle ? games.find((g: any) => g.title === bestTitle) : undefined) as any;
    if (named) {
      const review = await Review.findOne({ userId: uid, gameId: named._id }).lean();
      const status = STATUS_LABEL[named.progressStatus || "none"];
      const rated = review
        ? `You rated it ${review.rating}/10${review.reviewText ? `: "${review.reviewText}"` : "."}`
        : "You haven't rated it yet.";
      const statusText = status === STATUS_LABEL.none ? "has no status yet" : `is ${status === "Plan to Play" ? "on your Plan to Play list" : `marked ${status}`}`;
      let notesText = "";
      if (/\bnotes?\b/.test(q)) {
        const notes = await Note.find({ userId: uid, gameId: named._id }).sort({ createdAt: -1 }).lean();
        notesText = notes.length
          ? `\n\nYour ${notes.length === 1 ? "note" : `${notes.length} notes`}:\n${notes.map((n: any) => `- ${n.content}`).join("\n")}`
          : " You haven't written any notes on it yet.";
      }
      return this.success({ game: named.title, status: named.progressStatus, rating: review?.rating ?? null },
        `${named.title} ${statusText}. ${rated}${notesText}`);
    }

    const by = (status: string) => games.filter((g: any) => (g.progressStatus || "none") === status).map((g: any) => g.title as string);
    const counts = Object.fromEntries(Object.keys(STATUS_LABEL).map((s) => [s, by(s).length]));

    const has = (...words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(q));

    if (has("top", "best", "favou?rite", "highest", "rated", "rating")) {
      const reviews = await Review.find({ userId: uid }).sort({ rating: -1 }).limit(5).populate("gameId", "title").lean();
      const rated = reviews.filter((r: any) => r.gameId?.title).map((r: any) => `${r.gameId.title} (${r.rating}/10)`);
      return this.success({ rated }, rated.length
        ? `Your top rated: ${listTitles(rated)}.`
        : "You haven't rated any games yet. Try \"rate Hades 9\".");
    }

    if (has("recent", "latest", "last added", "newest", "just added")) {
      const recent = games.slice(0, 5).map((g: any) => g.title);
      return this.success({ recent }, `Most recently added: ${listTitles(recent)}.`);
    }

    if (has("backlog", "to play", "plan", "queue", "pile", "left to")) {
      const backlog = [...by("playing"), ...by("paused"), ...by("plan")];
      if (backlog.length === 0) {
        return this.success({ backlog }, "Your backlog is empty: nothing is set to Plan to Play, Playing or Paused.");
      }
      // One short list per status: "- Planned: A, B, C, D, E, F" on one line was hard to scan.
      const group = (label: string, titles: string[]) => {
        if (titles.length === 0) return "";
        const shown = titles.slice(0, 8).map((t) => `- ${t}`).join("\n");
        return `**${label}** (${titles.length})\n${shown}${titles.length > 8 ? `\n- and ${titles.length - 8} more` : ""}`;
      };
      const parts = [group("Playing", by("playing")), group("Paused", by("paused")), group("Planned", by("plan"))].filter(Boolean);
      return this.success({ backlog }, `You have ${plural(backlog.length, "game")} in your backlog:\n\n${parts.join("\n\n")}`);
    }

    const statusAsked = (
      [
        ["completed", ["finish", "complete", "beat", "done"]],
        ["playing", ["playing", "currently", "in progress", "on right now"]],
        ["paused", ["pause", "on hold", "break"]],
        ["dropped", ["drop", "abandon", "gave up"]],
      ] as const
    ).find(([, words]) => has(...words));
    if (statusAsked && !has("how many games", "total", "everything", "stats", "summary")) {
      const [status] = statusAsked;
      let titles = by(status);
      const label = STATUS_LABEL[status].toLowerCase();
      // "what have i beaten and what did i rate them": the ratings go with the list.
      if (titles.length && has("rate", "rating", "score")) {
        const reviews = await Review.find({ userId: uid }).populate("gameId", "title").lean();
        const ratingOf = new Map(reviews.filter((r: any) => r.gameId?.title).map((r: any) => [r.gameId.title as string, r.rating as number]));
        titles = titles.map((t) => (ratingOf.has(t) ? `${t} (${ratingOf.get(t)}/10)` : `${t} (not rated)`));
      }
      return this.success({ status, titles }, titles.length
        ? `${plural(titles.length, "game")} ${titles.length === 1 ? "is" : "are"} ${label}: ${listTitles(titles)}.`
        : `Nothing is marked ${label} right now.`);
    }

    // Default: a summary with counts ("how many games do I have and how many have I finished?").
    const breakdown = (["playing", "paused", "plan", "completed", "dropped", "none"] as const)
      .filter((s) => counts[s] > 0)
      .map((s) => `${counts[s]} ${STATUS_LABEL[s].toLowerCase()}`);
    const playingNow = counts.playing ? ` You're playing ${listTitles(by("playing"))}.` : "";
    return this.success(
      { total: games.length, counts },
      `You have ${plural(games.length, "game")}: ${breakdown.join(", ")}.${playingNow}`,
    );
  }
}
