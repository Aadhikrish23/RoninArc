export class ToolMapper {
  private readonly map: Record<string, string> = {
    "complete-game": "update_status",
    "launch-game": "launch_game",
    "review-game": "create_review",
    "collection": "create_collection",
  };

  /**
   * Maps a Capability ID to the corresponding tool name.
   */
  mapCapabilityToTool(capabilityId: string): string {
    const toolName = this.map[capabilityId];
    if (!toolName) {
      throw new Error(`No tool mapping found for capability: ${capabilityId}`);
    }
    return toolName;
  }
}

export default new ToolMapper();
