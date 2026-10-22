import { BaseTool } from "../../../../sdk/BaseTool";
import { AIToolContext } from "../../../../sdk/AIToolContext";
import { AIToolResult } from "../../../../sdk/AIToolResult";
import recommendationToolService from "../../services/RecommendationToolService";
import type { Recommendation } from "../../../../../recommendation/recommendationEngine";

interface RecommendGamesInput {
  query?: string;
}

// Two reasons, so a length or style the user asked for ("Shorter: about 10h") shows next to the taste match.
const describe = (r: Recommendation) => {
  const why = r.reasons.slice(0, 2).map((reason, i) => (i > 0 ? reason.charAt(0).toLowerCase() + reason.slice(1) : reason)).join("; ");
  return why ? `- **${r.title}**: ${why}` : `- **${r.title}**`;
};
const PICKS = 3;
/** "got 2 hrs tonight", "quick session": time-boxed, so lead with games already in progress. */
const SESSION = /\b\d+(\.\d+)?\s*(h|hr|hrs|hour|hours|min|mins|minutes)\b|\btonight\b|\bquick (session|game)\b|\bshort session\b/i;

/** "something chill from what i own": only the user's own games. */
const OWN_ONLY = /\b(what i (own|have|got)|i (already )?own|from my (library|backlog|games|collection)|in my (library|backlog)|my own games)\b/i;

/** Playing first, then paused, then the rest, for time-boxed requests. */
const rank = (r: Recommendation) => (r.status === "playing" ? 0 : r.status === "paused" ? 1 : 2);

export class RecommendGamesTool extends BaseTool<RecommendGamesInput, any> {
  readonly category = "recommendation";

  readonly name = "recommend_games";

  readonly description = "Suggests what to play next from the user's backlog and new games to discover.";

  async execute(input: RecommendGamesInput, context: AIToolContext): Promise<AIToolResult<any>> {
    const query = (input.query || "").trim() || undefined;
    const result = await recommendationToolService.recommend(context.userId, query);

    const parts: string[] = [];
    // Only claim "something you already have going" when a game really is in progress.
    const session = !!query && SESSION.test(query) && result.backlog.some((r) => r.status === "playing");
    if (result.backlog.length > 0) {
      const backlog = session
        ? [...result.backlog].sort((a, b) => rank(a) - rank(b))
        : result.backlog;
      // "already have going" only fits when every pick shown is in progress.
      const allInProgress = backlog.slice(0, PICKS).every((r) => r.status === "playing");
      const heading = !session
        ? "From your backlog, I'd play next:"
        : allInProgress
          ? "For a session tonight, I'd jump back into something you already have going:"
          : "For a session tonight, I'd pick from your backlog:";
      parts.push(`${heading}\n${backlog.slice(0, PICKS).map(describe).join("\n")}`);
    }
    // "what should I play tonight?" with a backlog to pick from: games they don't own are noise.
    const ownOnly = !!query && (OWN_ONLY.test(query) || (SESSION.test(query) && result.backlog.length >= 2));
    if (result.discover.length > 0 && !(ownOnly && result.backlog.length > 0)) {
      parts.push(`New to discover:\n${result.discover.slice(0, PICKS).map(describe).join("\n")}`);
    }

    if (parts.length === 0) {
      const scope = result.focus.length > 0 ? ` matching ${result.focus.join(", ")}` : "";
      const offline = result.discoverError ? " I also couldn't reach the game database to find new titles." : "";
      return this.success(
        result,
        `I don't have any recommendations${scope} yet -- add a few games to your backlog, or rate the ones you've played so I can learn your taste.${offline}`,
      );
    }

    if (!result.profile.personalized) {
      parts.push("Rate or finish a few games and these picks will get more personal.");
    }

    return this.success(result, parts.join("\n\n"));
  }
}
