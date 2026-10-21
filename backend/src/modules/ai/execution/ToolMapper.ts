// Capabilities whose tool is chosen per request inside mapCapabilityToTool().
// Keep in sync with the branches there; the startup check relies on it.
const MULTI_TOOL_CAPABILITIES: Record<string, string[]> = {
  "review-game": ["create_review", "delete_review"],
  "collection": ["create_collection", "add_to_collection", "remove_from_collection"],
};

export class ToolMapper {
  private readonly map: Record<string, string> = {
    "complete-game": "update_status",
    "set-status": "update_status",
    "library-question": "library_question",
    "launch-game": "launch_game",
    "collection": "create_collection",
    "connect-account": "connect_epic",
    "disconnect-account": "disconnect_epic",
    "sync-library": "sync_epic",
    "add-game": "add_game",
    "remove-game": "remove_game",
    "search-library": "search_library",
    "add-note": "add_note",
    "recommend-games": "recommend_games",
  };

  /**
   * Every tool this capability can ever resolve to (empty if unmapped).
   */
  possibleToolsFor(capabilityId: string): string[] {
    const multi = MULTI_TOOL_CAPABILITIES[capabilityId];
    if (multi) return [...multi];
    const single = this.map[capabilityId];
    return single ? [single] : [];
  }

  /**
   * Maps a Capability ID to the corresponding tool name.
   */
  mapCapabilityToTool(
    capabilityId: string,
    targetsOrInput?: any[] | Record<string, unknown>,
    queryOrIntentType?: string
  ): string {
    if (capabilityId === "review-game") {
      const queryText = (queryOrIntentType || "").toLowerCase();
      // A rating is never a delete: "get rid of cod mw2 and give gta 5 an 8" rated nothing and
      // answered "Review not found." because the message's "remove" picked delete_review.
      const params = Array.isArray(targetsOrInput) ? [] : ((targetsOrInput as any)?.parameters ?? []);
      if (Array.isArray(params) && params.some((p: any) => String(p?.type ?? "").toLowerCase() === "rating")) {
        return "create_review";
      }
      if (
        queryText.includes("delete") ||
        queryText.includes("remove") ||
        queryText.includes("erase")
      ) {
        return "delete_review";
      }
      return "create_review";
    }

    if (capabilityId === "collection") {
      let targets: any[] = [];
      let parameters: any[] = [];
      if (Array.isArray(targetsOrInput)) {
        targets = targetsOrInput;
      } else if (targetsOrInput && typeof targetsOrInput === "object") {
        targets = (targetsOrInput.targets as any[]) || [];
        const raw = (targetsOrInput as any).parameters;
        parameters = Array.isArray(raw) ? raw : [];
      }

      const hasGame = targets.some((t) => t.type === "Game" || t.type?.toLowerCase() === "game");

      // The intent's own Boolean says add (true/absent) or remove (false), so
      // "take X out and add Y" maps each part correctly instead of using the
      // whole message's keywords for both.
      const flag = parameters.find((p) => p && String(p.type).toLowerCase() === "boolean");
      if (hasGame && flag) {
        return flag.value === false || flag.value === "false" ? "remove_from_collection" : "add_to_collection";
      }

      const queryTextForCreate = (queryOrIntentType || "").toLowerCase();
      if (queryTextForCreate.includes("create") && !hasGame) {
        return "create_collection";
      }

      if (hasGame) {
        const queryText = (queryOrIntentType || "").toLowerCase();
        if (
          queryText.includes("remove") ||
          queryText.includes("delete") ||
          queryText.includes("erase") ||
          queryText.includes("drop") ||
          queryText.includes("take out") ||
          /\btake .+ out\b/.test(queryText) ||
          queryText.includes("out of") ||
          queryText.includes("withdraw") ||
          queryText.includes("removefromcollection")
        ) {
          return "remove_from_collection";
        }
        return "add_to_collection";
      }
      return "create_collection";
    }

    const toolName = this.map[capabilityId];
    if (!toolName) {
      throw new Error(`No tool mapping found for capability: ${capabilityId}`);
    }
    return toolName;
  }
}

export default new ToolMapper();
