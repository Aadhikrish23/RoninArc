// Destructive/irreversible tools must never guess their target from a stale
// conversation reference (e.g. "currentGame" left over from an unrelated earlier
// action) when the LLM failed to name one explicitly -- ask the user instead of
// risking deleting/disconnecting/removing the wrong thing.
export const NO_REFERENCE_FALLBACK_TOOLS = new Set(["delete_review", "remove_from_collection", "disconnect_epic", "remove_game"]);
