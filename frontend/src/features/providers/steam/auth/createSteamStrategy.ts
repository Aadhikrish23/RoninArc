import { isElectron } from "../../../../shared/utils/runtime";
import type { SteamAuthStrategy } from "./SteamAuthStrategy";
import { BrowserSteamStrategy } from "./BrowserSteamStrategy";
import { ElectronSteamStrategy } from "./ElectronSteamStrategy";

/**
 * Factory that returns the correct Steam sign-in strategy for the current
 * runtime without leaking any branching logic into UI components.
 *
 * Usage:
 *   const strategy = createSteamStrategy();
 *   const result   = await strategy.authenticate();
 */
export function createSteamStrategy(): SteamAuthStrategy {
  return isElectron() ? new ElectronSteamStrategy() : new BrowserSteamStrategy();
}
