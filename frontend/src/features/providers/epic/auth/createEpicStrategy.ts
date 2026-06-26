import { isElectron } from "../../../../shared/utils/runtime";
import type { EpicAuthStrategy } from "./EpicAuthStrategy";
import { BrowserEpicStrategy } from "./BrowserEpicStrategy";
import { ElectronEpicStrategy } from "./ElectronEpicStrategy";

/**
 * Factory that returns the correct Epic authentication strategy for the
 * current runtime without leaking any branching logic into UI components.
 *
 * Usage:
 *   const strategy = createEpicStrategy();
 *   const result   = await strategy.authenticate();
 */
export function createEpicStrategy(): EpicAuthStrategy {
  return isElectron() ? new ElectronEpicStrategy() : new BrowserEpicStrategy();
}
