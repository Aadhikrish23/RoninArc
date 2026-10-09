/** What the calling app can do itself. The web build can't start games; the desktop app can. */
export interface AIClientCapabilities {
  canLaunchGames: boolean;
}

/**
 * Something a tool asks the calling app to do, because only the app can do it
 * (starting a game process happens on the player's PC, not on the server).
 * Returned to the client as `clientActions` in the chat response.
 */
export interface AIClientAction {
  type: "launch_game";
  gameId: string;
  title: string;
}

export interface AIToolContext {
  userId: string;
  requestId?: string;
  client?: AIClientCapabilities;
  /** Collected during execution; tools push here, the runtime returns them. */
  clientActions?: AIClientAction[];
}
