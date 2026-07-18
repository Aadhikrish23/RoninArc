export class ToolMapper {
  private readonly map: Record<string, string> = {
    "complete-game": "update_status",
    "launch-game": "launch_game",
    "review-game": "create_review",
    "collection": "create_collection",
    "connect-account": "connect_epic",
    "disconnect-account": "disconnect_epic",
    "sync-library": "sync_epic",
  };

  /**
   * Maps a Capability ID to the corresponding tool name.
   */
  mapCapabilityToTool(
    capabilityId: string,
    targetsOrInput?: any[] | Record<string, unknown>,
    queryOrIntentType?: string
  ): string {
    if (capabilityId === "collection") {
      let targets: any[] = [];
      if (Array.isArray(targetsOrInput)) {
        targets = targetsOrInput;
      } else if (targetsOrInput && typeof targetsOrInput === "object") {
        targets = (targetsOrInput.targets as any[]) || [];
      }

      const hasGame = targets.some((t) => t.type === "Game" || t.type?.toLowerCase() === "game");
      if (hasGame) {
        const queryText = (queryOrIntentType || "").toLowerCase();
        if (
          queryText.includes("remove") ||
          queryText.includes("delete") ||
          queryText.includes("erase") ||
          queryText.includes("drop") ||
          queryText.includes("take out") ||
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
