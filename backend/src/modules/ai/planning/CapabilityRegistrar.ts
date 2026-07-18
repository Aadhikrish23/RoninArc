import registry from "./CapabilityRegistry";
import { IntentType } from "../intent/IntentType";
import { ContextCategory } from "../context/ContextCategory";

export function registerCapabilities() {
  registry.register({
    id: "complete-game",
    name: "Complete Game",
    description: "Marks a game as completed.",
    intentType: IntentType.CompleteGame,
    requirements: [
      { contextCategory: ContextCategory.Library },
      { contextCategory: ContextCategory.PlaySessions },
    ],
  });

  registry.register({
    id: "launch-game",
    name: "Launch Game",
    description: "Launches a game.",
    intentType: IntentType.LaunchGame,
    requirements: [
      { contextCategory: ContextCategory.Library },
      { contextCategory: ContextCategory.PlaySessions },
    ],
  });

  registry.register({
    id: "review-game",
    name: "Review Game",
    description: "Creates or updates reviews.",
    intentType: IntentType.ReviewGame,
    requirements: [
      { contextCategory: ContextCategory.Reviews },
      { contextCategory: ContextCategory.Library },
    ],
  });

  registry.register({
    id: "collection",
    name: "Manage Collection",
    description: "Creates and edits collections.",
    intentType: IntentType.OrganizeCollection,
    requirements: [
      { contextCategory: ContextCategory.Collections },
      { contextCategory: ContextCategory.Library },
    ],
  });

  registry.register({
    id: "connect-account",
    name: "Connect Account",
    description: "Connects a provider account.",
    intentType: IntentType.ConnectAccount,
    requirements: [],
  });

  registry.register({
    id: "disconnect-account",
    name: "Disconnect Account",
    description: "Disconnects a provider account.",
    intentType: IntentType.DisconnectAccount,
    requirements: [],
  });

  registry.register({
    id: "sync-library",
    name: "Sync Library",
    description: "Syncs game library with provider.",
    intentType: IntentType.SyncLibrary,
    requirements: [],
  });

  return registry;
}