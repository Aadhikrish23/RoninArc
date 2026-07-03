import { ToolRegistry } from "./ToolRegistry";

import { UpdateStatusTool } from "../actions/library/UpdateStatusTool";
import { CreateReviewTool } from "../actions/review/CreateReviewTool";
import { UpdateReviewTool } from "../actions/review/UpdateReviewTool";
import { DeleteReviewTool } from "../actions/review/DeleteReviewTool";
import { CreateCollectionTool } from "../actions/collection/CreateCollectionTool";
import { AddToCollectionTool } from "../actions/collection/AddToCollectionTool";
import { RemoveFromCollectionTool } from "../actions/collection/RemoveFromCollectionTool";
import { ConnectEpicTool } from "../actions/provider/ConnectEpicTool";
import { DisconnectEpicTool } from "../actions/provider/DisconnectEpicTool";
import { SyncEpicTool } from "../actions/provider/SyncEpicTool";
import { LaunchGameTool } from "../actions/launcher/LaunchGameTool";
import { SearchRawgTool } from "../actions/rawg/SearchRawgTool";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Library Tools
  registry.register(new UpdateStatusTool());

  // Review Tools
  registry.register(new CreateReviewTool());
  registry.register(new UpdateReviewTool());
  registry.register(new DeleteReviewTool());

  // Collection Tools
  registry.register(new CreateCollectionTool());
  registry.register(new AddToCollectionTool());
  registry.register(new RemoveFromCollectionTool());

  // Provider Tools
  registry.register(new ConnectEpicTool());
  registry.register(new DisconnectEpicTool());
  registry.register(new SyncEpicTool());

  // Launcher Tools
  registry.register(new LaunchGameTool());

  // RAWG Tools
  registry.register(new SearchRawgTool());

  return registry;
}