import { ToolCapability } from "./ToolCapability";

export class ToolMetadataRegistry {
  private readonly capabilities = new Map<string, ToolCapability>();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Registers a tool capability metadata. Only registers once.
   */
  register(capability: ToolCapability): void {
    if (this.capabilities.has(capability.id)) {
      return;
    }
    this.capabilities.set(capability.id, capability);
  }

  /**
   * Resolves capability metadata by ID or name.
   */
  get(id: string): ToolCapability | null {
    return this.capabilities.get(id) || null;
  }

  /**
   * Lists all registered capabilities.
   */
  list(): ToolCapability[] {
    return Array.from(this.capabilities.values());
  }

  private registerDefaults(): void {
    const defaults: ToolCapability[] = [
      {
        id: "launch_game",
        supportedIntent: "launch_game",
        supportedEntityTypes: ["Game"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["gameId"],
        optionalParameters: [],
        description: "Launches a game in the user library",
        parameters: [
          { name: "gameId", type: "string", required: true },
        ],
      },
      {
        id: "install_game",
        supportedIntent: "install_game",
        supportedEntityTypes: ["Game"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["gameId"],
        optionalParameters: [],
        description: "Installs a game",
        parameters: [
          { name: "gameId", type: "string", required: true },
        ],
      },
      {
        id: "create_collection",
        supportedIntent: "create_collection",
        supportedEntityTypes: ["Collection"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["name"],
        optionalParameters: [],
        description: "Creates a new game collection",
        parameters: [
          { name: "name", type: "string", required: true },
        ],
      },
      {
        id: "add_to_collection",
        supportedIntent: "add_to_collection",
        supportedEntityTypes: ["Collection", "Game"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["collectionName", "gameId"],
        optionalParameters: [],
        description: "Adds a game to a collection",
        parameters: [
          { name: "collectionName", type: "string", required: true },
          { name: "gameId", type: "string", required: true },
        ],
      },
      {
        id: "remove_from_collection",
        supportedIntent: "remove_from_collection",
        supportedEntityTypes: ["Collection", "Game"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["collectionName", "gameId"],
        optionalParameters: [],
        description: "Removes a game from a collection",
        parameters: [
          { name: "collectionName", type: "string", required: true },
          { name: "gameId", type: "string", required: true },
        ],
      },
      {
        id: "add_game",
        supportedIntent: "add_game",
        supportedEntityTypes: ["Library"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["gameName"],
        optionalParameters: [],
        description: "Searches RAWG and adds a game to the user's library",
        parameters: [
          { name: "gameName", type: "string", required: true },
        ],
      },
      {
        id: "remove_game",
        supportedIntent: "remove_game",
        supportedEntityTypes: ["Game"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["gameId"],
        optionalParameters: [],
        description: "Removes a game from the user's library",
        parameters: [
          { name: "gameId", type: "string", required: true },
        ],
      },
      {
        id: "search_library",
        supportedIntent: "search_library",
        supportedEntityTypes: [],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["searchValue"],
        optionalParameters: ["searchParam"],
        description: "Searches the user's library by title, tag, or status",
        parameters: [
          { name: "searchValue", type: "string", required: true },
          { name: "searchParam", type: "string", required: false },
        ],
      },
      {
        id: "update_status",
        supportedIntent: "update_status",
        supportedEntityTypes: ["Game"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["gameId", "status"],
        optionalParameters: [],
        description: "Updates game library play status",
        parameters: [
          { name: "gameId", type: "string", required: true },
          { name: "status", type: "string", required: true },
        ],
      },
      {
        id: "create_review",
        supportedIntent: "create_review",
        supportedEntityTypes: ["Game"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["gameId", "rating"],
        optionalParameters: ["reviewText"],
        description: "Creates a review for a game",
        parameters: [
          { name: "gameId", type: "string", required: true },
          { name: "rating", type: "number", required: true },
          { name: "reviewText", type: "string", required: false },
        ],
      },
      {
        id: "delete_review",
        supportedIntent: "delete_review",
        supportedEntityTypes: ["Game"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: ["gameId"],
        optionalParameters: [],
        description: "Deletes a review for a game",
        parameters: [
          { name: "gameId", type: "string", required: true },
        ],
      },
      {
        id: "connect_epic",
        supportedIntent: "connect_epic",
        supportedEntityTypes: ["Provider"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: [],
        optionalParameters: ["authorizationCode", "localGames"],
        description: "Connects Epic Games account",
        parameters: [
          { name: "authorizationCode", type: "string", required: false },
          { name: "localGames", type: "object", required: false },
        ],
      },
      {
        id: "disconnect_epic",
        supportedIntent: "disconnect_epic",
        supportedEntityTypes: ["Provider"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: [],
        optionalParameters: [],
        description: "Disconnects Epic Games account",
        parameters: [],
      },
      {
        id: "sync_epic",
        supportedIntent: "sync_epic",
        supportedEntityTypes: ["Provider"],
        executionPolicy: "SEQUENTIAL",
        requiredParameters: [],
        optionalParameters: ["localGames"],
        description: "Syncs Epic Games library",
        parameters: [
          { name: "localGames", type: "object", required: false },
        ],
      },
    ];

    for (const capability of defaults) {
      this.register(capability);
    }
  }
}

export default new ToolMetadataRegistry();
