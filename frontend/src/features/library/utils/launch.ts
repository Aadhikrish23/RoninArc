import type { Game } from "../types/library";
import { PROVIDER_CONFIGS } from "../../providers/constants/providers";
import type { ProviderId } from "../../providers/types/provider";

/**
 * Launch resolution result.
 * - `path` is the executable path or launcher URI to invoke.
 * - `type` indicates what kind of launch target was resolved:
 *     "manual"   → user-set exePath override
 *     "provider" → executable from providers.<provider>
 *     "launcher"  → provider-specific launcher URI fallback
 *     "none"     → nothing resolved — prompt user for executable
 */
export interface LaunchResolution {
  path: string;
  type: "manual" | "provider" | "launcher" | "none";
  provider?: string;
}

/**
 * Resolves the best launch target for a game.
 *
 * Priority:
 *   1. User manual executable override (game.exePath)
 *   2. Provider executable stored in providers.<provider>.executable
 *   3. Empty string → caller should prompt user for executable (Launcher URIs are offered as user-chosen fallbacks in modal)
 */
export function resolveLaunch(game: Game): LaunchResolution {
  // Priority 1: User manual override
  if (game.exePath) {
    return { path: game.exePath, type: "manual" };
  }

  // Priority 2: Provider executable (first installed provider with an executable)
  for (const providerKey of Object.keys(game.providers || {})) {
    const p = game.providers?.[providerKey];
    if (p?.installed && p?.executable) {
      return { path: p.executable, type: "provider", provider: providerKey };
    }
  }

  // Priority 3: Nothing resolved — prompt the user
  return { path: "", type: "none" };
}

export const getLaunchPath = (game: Game): string => {
  return resolveLaunch(game).path;
};

/**
 * Returns a provider-specific launcher URI for games that are installed
 * but have no direct executable detected.
 */
export function getProviderLauncherUri(
  providerKey: string,
  providerData: NonNullable<Game["providers"]>[string]
): string | null {
  switch (providerKey) {
    case "steam": {
      // Steam games can be launched via steam://rungameid/<appId>
      const appId = providerData.providerGameId || providerData.manifestId;
      if (appId) {
        return `steam://rungameid/${appId}`;
      }
      return null;
    }
    case "epic": {
      // Epic games can be launched via com.epicgames.launcher://apps/<catalogItemId>?action=launch&silent=true
      const catalogId = providerData.providerGameId;
      if (catalogId) {
        return `com.epicgames.launcher://apps/${catalogId}?action=launch&silent=true`;
      }
      return null;
    }
    default:
      return null;
  }
}

const LAUNCHERS_WITH_GAME_PAGES = ["steam", "epic"];

export interface GamePage {
  /** Launcher name, as shown on the button. */
  name: string;
  provider: string;
  gameId: string;
  namespace?: string;
}

/**
 * The game's page in the launcher that owns it, for a game you don't have on this PC.
 * Null when it's already installed, or isn't from a launcher we can link to.
 */
export function getGamePage(game: Game): GamePage | null {
  const providers = Object.entries(game.providers || {});
  if (providers.some(([, data]) => data.installed === true)) return null;

  for (const [key, data] of providers) {
    if (LAUNCHERS_WITH_GAME_PAGES.includes(key) && data.providerGameId) {
      return {
        name: PROVIDER_CONFIGS[key as ProviderId]?.name ?? key,
        provider: key,
        gameId: data.providerGameId,
        namespace: data.namespace,
      };
    }
  }
  return null;
}
