/**
 * Centralised runtime detection.
 * Never scatter `window.electronAPI` checks across the application.
 * Import this utility wherever runtime-specific behaviour is required.
 */
export function isElectron(): boolean {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
}
