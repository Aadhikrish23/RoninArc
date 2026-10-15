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
    id: "set-status",
    name: "Set Status",
    description: "Changes a game's progress status: plan to play, playing, paused, completed, dropped, or none.",
    intentType: IntentType.SetStatus,
    requirements: [{ contextCategory: ContextCategory.Library }],
  });

  registry.register({
    id: "library-question",
    name: "Library Question",
    description: "Answers questions about the user's own library: backlog, counts, what's being played or finished, recently added, top rated.",
    intentType: IntentType.LibraryQuestion,
    requirements: [{ contextCategory: ContextCategory.Library }],
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
    id: "add-game",
    name: "Add Game",
    description: "Searches RAWG and adds a game to your library.",
    intentType: IntentType.AddGame,
    requirements: [{ contextCategory: ContextCategory.Library }],
  });

  registry.register({
    id: "remove-game",
    name: "Remove Game",
    description: "Removes a game from your library.",
    intentType: IntentType.RemoveGame,
    requirements: [{ contextCategory: ContextCategory.Library }],
  });

  registry.register({
    id: "search-library",
    name: "Search Library",
    description: "Searches your library by title, tag, or status.",
    intentType: IntentType.SearchLibrary,
    requirements: [{ contextCategory: ContextCategory.Library }],
  });

  registry.register({
    id: "add-note",
    name: "Add Note",
    description: "Adds a personal note to a game.",
    intentType: IntentType.AddNote,
    requirements: [{ contextCategory: ContextCategory.Library }],
  });

  registry.register({
    id: "recommend-games",
    name: "Recommend Games",
    description: "Suggests what to play next from the user's backlog and new games to discover, based on their taste.",
    intentType: IntentType.RecommendGame,
    requirements: [{ contextCategory: ContextCategory.Library }],
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