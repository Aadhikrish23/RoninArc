/**
 * Centralised runtime detection.
 * Never scatter `window.electronAPI` checks across the application.
 * Import this utility wherever runtime-specific behaviour is required.
 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
}

/**
 * Launching a game, tracking it as running and scanning local installs all
 * need the desktop shell. In a plain browser these controls are hidden: the
 * launch call is a no-op there, so offering it would only start a play
 * session that nothing ever ends.
 */
export function canLaunchGames(): boolean {
  return isElectron();
}
