import { BaseTool } from "../BaseTool";
import { AIToolContext } from "../../sdk/AIToolContext";
import { AIToolResult } from "../../sdk/AIToolResult";
import recommendationToolService from "../../services/RecommendationToolService";
import type { Recommendation } from "../../../recommendation/recommendationEngine";

interface RecommendGamesInput {
  query?: string;
}

const describe = (r: Recommendation) => `${r.title} (${r.reasons[0]})`;

export class RecommendGamesTool extends BaseTool<RecommendGamesInput, any> {
  readonly category = "recommendation";

  readonly name = "recommend_games";

  readonly description = "Suggests what to play next from the user's backlog and new games to discover.";

  async execute(input: RecommendGamesInput, context: AIToolContext): Promise<AIToolResult<any>> {
    const query = (input.query || "").trim() || undefined;
    const result = await recommendationToolService.recommend(context.userId, query);

    const parts: string[] = [];
    if (result.backlog.length > 0) {
      parts.push(`From your backlog, I'd play next: ${result.backlog.map(describe).join("; ")}.`);
    }
    if (result.discover.length > 0) {
      parts.push(`New to discover: ${result.discover.map(describe).join("; ")}.`);
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

    return this.success(result, parts.join(" "));
  }
}
