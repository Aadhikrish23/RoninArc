import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.1.0",
    info: {
      title: "RoninArc Backend API",
      version: "1.0.0",
      description: "Production-grade developer portal and API reference for the RoninArc Game Launcher & AI assistant backend. Exposes endpoints for authentication, library management, collection tracking, reviews, game providers sync, playtime tracking, activity logging, and the AI agent co-pilot.",
      contact: {
        name: "RoninArc Support",
        email: "support@roninarc.com",
      },
      license: {
        name: "Proprietary",
        url: "https://roninarc.com/license",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Bearer JWT token to access protected API endpoints.",
        },
      },
      schemas: {
        // --- AUTH & USER SCHEMAS ---
        User: {
          type: "object",
          description: "User account profile document.",
          properties: {
            id: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
            username: { type: "string", example: "antigravity" },
            email: { type: "string", format: "email", example: "antigravity@gemini.com" },
            providers: {
              type: "object",
              description: "Third-party game provider sync integrations.",
              properties: {
                epic: {
                  type: "object",
                  properties: {
                    epicAccountId: { type: "string", example: "e93fca1028ba49539201a09dfba410b2" },
                    displayName: { type: "string", example: "AadhiEpic" },
                    connectedAt: { type: "string", format: "date-time", example: "2026-07-05T12:00:00Z" },
                    lastSyncAt: { type: "string", format: "date-time", example: "2026-07-05T15:30:00Z" },
                  },
                },
                steam: {
                  type: "object",
                  properties: {
                    displayName: { type: "string", example: "AadhiSteam" },
                    connectedAt: { type: "string", format: "date-time", example: "2026-07-05T12:05:00Z" },
                    lastSyncAt: { type: "string", format: "date-time", example: "2026-07-05T15:35:00Z" },
                  },
                },
              },
            },
            createdAt: { type: "string", format: "date-time", example: "2026-07-04T10:00:00Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-07-05T21:00:00Z" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", example: "antigravity" },
            password: { type: "string", format: "password", example: "supersecretpassword123" },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            Status: { type: "string", example: "Success" },
            Data: {
              type: "object",
              properties: {
                accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                refreshToken: { type: "string", example: "d7515fc3-8472-4d7a-b9c1-5fb901cebfd1" },
                user: {
                  type: "object",
                  properties: {
                    id: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
                    username: { type: "string", example: "antigravity" },
                    email: { type: "string", example: "antigravity@gemini.com" },
                  },
                },
              },
            },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 2, maxLength: 200, example: "antigravity" },
            password: { type: "string", minLength: 6, example: "supersecretpassword123" },
            email: { type: "string", format: "email", example: "antigravity@gemini.com" },
          },
        },
        ChangePasswordRequest: {
          type: "object",
          required: ["currentPassword", "newPassword"],
          properties: {
            currentPassword: { type: "string", example: "supersecretpassword123" },
            newPassword: { type: "string", example: "brandnewsecurepassword987" },
          },
        },
        DeleteAccountRequest: {
          type: "object",
          required: ["password"],
          properties: {
            password: { type: "string", example: "supersecretpassword123" },
          },
        },

        // --- LIBRARY SCHEMAS ---
        ProviderOwnership: {
          type: "object",
          properties: {
            providerGameId: { type: "string", example: "525141e976db40c9bc27bb30560b4317" },
            providerTitle: { type: "string", example: "Fallout Shelter" },
            owned: { type: "boolean", example: true },
            installed: { type: "boolean", example: true },
            launcher: { type: "string", example: "steam" },
            installPath: { type: "string", example: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Fallout Shelter" },
            manifestId: { type: "string", example: "588430" },
            executable: { type: "string", example: "FalloutShelter.exe" },
            syncedAt: { type: "string", format: "date-time", example: "2026-07-05T20:55:00.000Z" },
          },
        },
        MetadataState: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["none", "pending", "enriching", "complete", "failed"], example: "complete" },
            lastAttempt: { type: "string", format: "date-time", example: "2026-07-05T20:56:00.000Z" },
            lastSuccess: { type: "string", format: "date-time", example: "2026-07-05T20:56:05.000Z" },
            lastError: { type: "string", example: "" },
          },
        },
        GameArtwork: {
          type: "object",
          properties: {
            selectedSource: { type: "string", enum: ["manual", "rawg", "epic", "steam", "gog", "ea", "ubisoft", "xbox"], example: "rawg" },
            sources: {
              type: "object",
              additionalProperties: { type: "string" },
              example: {
                rawg: "https://media.rawg.io/media/games/054/054d89a421f114c022634d168532f811.jpg",
                epic: "https://cdn1.epicgames.com/offer/fallout-shelter/egs-card_600x900.jpg",
              },
            },
          },
        },
        GameLibrary: {
          type: "object",
          properties: {
            id: { type: "string", example: "64b0f4fa9c0d12e098a5e3f9" },
            userId: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
            rawgId: { type: "integer", nullable: true, example: 588430 },
            title: { type: "string", example: "Fallout Shelter" },
            description: { type: "string", example: "Fallout Shelter puts you in control of a state-of-the-art underground Vault from Vault-Tec." },
            tags: { type: "array", items: { type: "string" }, example: ["Survival", "Base Building", "Simulation"] },
            artwork: { $ref: "#/components/schemas/GameArtwork" },
            imageURL: { type: "string", example: "https://media.rawg.io/media/games/054/054d89a421f114c022634d168532f811.jpg" },
            developer: { type: "string", example: "Bethesda Game Studios" },
            exePath: { type: "string", example: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Fallout Shelter\\FalloutShelter.exe" },
            progressStatus: { type: "string", enum: ["none", "plan", "playing", "paused", "completed", "dropped"], example: "playing" },
            providers: {
              type: "object",
              additionalProperties: { $ref: "#/components/schemas/ProviderOwnership" },
            },
            provider: { type: "string", enum: ["manual", "epic", "steam", "gog", "ea", "ubisoft", "xbox"], example: "steam" },
            providerGameId: { type: "string", example: "588430" },
            providerTitle: { type: "string", example: "Fallout Shelter" },
            normalizedTitle: { type: "string", example: "fallout shelter" },
            metadataSyncedAt: { type: "string", format: "date-time", example: "2026-07-05T20:56:05.000Z" },
            screenshots: { type: "array", items: { type: "string" }, example: ["https://media.rawg.io/media/screenshots/a1b/a1b2c3d4.jpg"] },
            trailers: { type: "array", items: { type: "string" }, example: [] },
            rawgRating: { type: "number", example: 3.5 },
            metacritic: { type: "integer", nullable: true, example: 71 },
            website: { type: "string", example: "https://falloutshelter.com" },
            playtime: { type: "number", example: 120 },
            developers: { type: "array", items: { type: "string" }, example: ["Bethesda Game Studios"] },
            publishers: { type: "array", items: { type: "string" }, example: ["Bethesda Softworks"] },
            metadataState: { $ref: "#/components/schemas/MetadataState" },
            createdAt: { type: "string", format: "date-time", example: "2026-07-04T12:00:00Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-07-05T21:10:00Z" },
          },
        },
        AddGameRequest: {
          type: "object",
          required: ["rawgId", "title", "tags"],
          properties: {
            rawgId: { type: "integer", example: 588430 },
            title: { type: "string", example: "Fallout Shelter" },
            description: { type: "string", example: "Vault management game." },
            tags: { type: "array", items: { type: "string" }, example: ["Survival", "Simulation"] },
            imageURL: { type: "string", example: "https://media.rawg.io/media/games/054/054d89a421f114c022634d168532f811.jpg" },
            exePath: { type: "string", example: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Fallout Shelter\\FalloutShelter.exe" },
            progressStatus: { type: "string", enum: ["none", "plan", "playing", "paused", "completed", "dropped"], example: "plan" },
          },
        },
        UpdateGameRequest: {
          type: "object",
          properties: {
            tags: { type: "array", items: { type: "string" }, example: ["Fav", "Survival"] },
            progressStatus: { type: "string", enum: ["none", "plan", "playing", "paused", "completed", "dropped"], example: "playing" },
            exePath: { type: "string", example: "C:\\Games\\Fallout Shelter\\FalloutShelter.exe" },
          },
        },

        // --- RAWG SCHEMAS ---
        RAWGGameDetails: {
          type: "object",
          properties: {
            id: { type: "integer", example: 3498 },
            slug: { type: "string", example: "grand-theft-auto-v" },
            name: { type: "string", example: "Grand Theft Auto V" },
            description: { type: "string", example: "Grand Theft Auto V is an action-adventure game..." },
            released: { type: "string", example: "2013-09-17" },
            background_image: { type: "string", example: "https://media.rawg.io/media/games/84d/84da2c3a0058b885c5471fd84e87000e.jpg" },
            rating: { type: "number", example: 4.47 },
            metacritic: { type: "integer", example: 96 },
            playtime: { type: "integer", example: 73 },
          },
        },

        // --- DASHBOARD SCHEMAS ---
        DashboardStats: {
          type: "object",
          properties: {
            totalGames: { type: "integer", example: 12 },
            completedGames: { type: "integer", example: 3 },
            playingGames: { type: "integer", example: 2 },
            backlogGames: { type: "integer", example: 5 },
            totalPlaytimeHours: { type: "number", example: 24.5 },
            recentActivityCount: { type: "integer", example: 15 },
          },
        },

        // --- REVIEW SCHEMAS ---
        Review: {
          type: "object",
          properties: {
            id: { type: "string", example: "64b0f5cd9c0d12e098a5e402" },
            userId: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
            gameId: { type: "string", example: "64b0f4fa9c0d12e098a5e3f9" },
            rating: { type: "integer", minimum: 1, maximum: 10, example: 9 },
            reviewText: { type: "string", example: "Incredibly addictive base building game, perfect for quick sessions." },
            createdAt: { type: "string", format: "date-time", example: "2026-07-05T20:00:00Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-07-05T21:00:00Z" },
          },
        },
        ReviewUpsertRequest: {
          type: "object",
          required: ["rating"],
          properties: {
            rating: { type: "integer", minimum: 1, maximum: 10, example: 9 },
            reviewText: { type: "string", example: "Outstanding game design and mechanics." },
          },
        },

        // --- COLLECTION SCHEMAS ---
        Collection: {
          type: "object",
          properties: {
            id: { type: "string", example: "64b0f69a9c0d12e098a5e40a" },
            userId: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
            name: { type: "string", example: "Souls-like Favorites" },
            description: { type: "string", example: "My completed and favorite soulslike action RPG games." },
            gameIds: { type: "array", items: { type: "string" }, example: ["64b0f4fa9c0d12e098a5e3f9"] },
            createdAt: { type: "string", format: "date-time", example: "2026-07-04T15:00:00Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-07-05T12:00:00Z" },
          },
        },
        CreateCollectionRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", example: "Souls-like Favorites" },
            description: { type: "string", example: "My completed and favorite soulslike action RPG games." },
          },
        },
        UpdateCollectionRequest: {
          type: "object",
          properties: {
            name: { type: "string", example: "Souls-like Classics" },
            description: { type: "string", example: "All souls-like titles." },
          },
        },
        AddGameToCollectionRequest: {
          type: "object",
          required: ["gameId"],
          properties: {
            gameId: { type: "string", example: "64b0f4fa9c0d12e098a5e3f9" },
          },
        },

        // --- PLAY SESSION SCHEMAS ---
        PlaySession: {
          type: "object",
          properties: {
            id: { type: "string", example: "64b0f71c9c0d12e098a5e415" },
            userId: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
            gameId: { type: "string", example: "64b0f4fa9c0d12e098a5e3f9" },
            startedAt: { type: "string", format: "date-time", example: "2026-07-05T20:00:00.000Z" },
            endedAt: { type: "string", format: "date-time", nullable: true, example: "2026-07-05T20:45:00.000Z" },
            durationMinutes: { type: "number", example: 45 },
            createdAt: { type: "string", format: "date-time", example: "2026-07-05T20:00:00Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-07-05T20:45:00Z" },
          },
        },
        PlaytimeStats: {
          type: "object",
          properties: {
            totalPlaytimeMinutes: { type: "number", example: 1200 },
            gameStats: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  gameId: { type: "string", example: "64b0f4fa9c0d12e098a5e3f9" },
                  title: { type: "string", example: "Fallout Shelter" },
                  playtimeMinutes: { type: "number", example: 120 },
                },
              },
            },
          },
        },
        GamePlaytimeStats: {
          type: "object",
          properties: {
            gameId: { type: "string", example: "64b0f4fa9c0d12e098a5e3f9" },
            totalPlaytimeMinutes: { type: "number", example: 120 },
            sessions: {
              type: "array",
              items: { $ref: "#/components/schemas/PlaySession" },
            },
          },
        },

        // --- PROVIDERS SCHEMAS ---
        ProviderStatus: {
          type: "object",
          properties: {
            connected: { type: "boolean", example: true },
            displayName: { type: "string", example: "Local Steam" },
            connectedAt: { type: "string", format: "date-time", example: "2026-07-05T12:05:00Z" },
            importedGames: { type: "integer", example: 5 },
            lastSync: { type: "string", format: "date-time", example: "2026-07-05T15:35:00Z" },
          },
        },
        EpicConnectRequest: {
          type: "object",
          required: ["authorizationCode"],
          properties: {
            authorizationCode: { type: "string", example: "10db8421bcab48dca2a3e5c9a721c5f8" },
            localGames: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  catalogItemId: { type: "string", example: "a438..." },
                  name: { type: "string", example: "Fallout Shelter" },
                  installPath: { type: "string", example: "C:\\EpicGames\\FalloutShelter" },
                  epicId: { type: "string", example: "588430" },
                  executable: { type: "string", example: "FalloutShelter.exe" },
                },
              },
            },
          },
        },
        SteamConnectRequest: {
          type: "object",
          properties: {
            localGames: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  appId: { type: "string", example: "588430" },
                  name: { type: "string", example: "Fallout Shelter" },
                  installPath: { type: "string", example: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Fallout Shelter" },
                  executable: { type: "string", example: "FalloutShelter.exe" },
                },
              },
            },
          },
        },
        RefreshInstallationsRequest: {
          type: "object",
          properties: {
            installations: {
              type: "object",
              properties: {
                steam: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      appId: { type: "string", example: "588430" },
                      name: { type: "string", example: "Fallout Shelter" },
                      installPath: { type: "string", example: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Fallout Shelter" },
                      executable: { type: "string", example: "FalloutShelter.exe" },
                    },
                  },
                },
                epic: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      catalogItemId: { type: "string", example: "a438..." },
                      name: { type: "string", example: "Fallout Shelter" },
                      installPath: { type: "string", example: "C:\\EpicGames\\FalloutShelter" },
                      epicId: { type: "string", example: "588430" },
                      executable: { type: "string", example: "FalloutShelter.exe" },
                    },
                  },
                },
              },
            },
          },
        },

        // --- ACTIVITY SCHEMAS ---
        Activity: {
          type: "object",
          properties: {
            id: { type: "string", example: "64b0f79d9c0d12e098a5e420" },
            userId: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
            type: {
              type: "string",
              enum: [
                "GAME_ADDED",
                "GAME_REMOVED",
                "STATUS_CHANGED",
                "REVIEW_CREATED",
                "REVIEW_UPDATED",
                "REVIEW_DELETED",
                "COLLECTION_CREATED",
                "COLLECTION_DELETED",
                "GAME_ADDED_TO_COLLECTION",
                "GAME_REMOVED_FROM_COLLECTION",
                "GAME_LAUNCHED",
                "COLLECTION_UPDATED",
              ],
              example: "GAME_LAUNCHED",
            },
            message: { type: "string", example: "Launched Fallout Shelter" },
            gameId: { type: "string", example: "64b0f4fa9c0d12e098a5e3f9" },
            collectionId: { type: "string", nullable: true, example: null },
            createdAt: { type: "string", format: "date-time", example: "2026-07-05T20:55:00.000Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-07-05T20:55:00.000Z" },
          },
        },

        // --- AI SCHEMAS ---
        AIRequest: {
          type: "object",
          required: ["message"],
          properties: {
            message: {
              type: "string",
              description: "Natural language query to be executed by the AI co-pilot agent.",
              example: "Launch Fallout Shelter",
            },
          },
        },
        AIResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "I have successfully launched Fallout Shelter." },
            sessionId: { type: "string", example: "e10b10db-8421-4dca-2a3e-5c9a721c5f8f" },
            status: { type: "string", example: "ACTIVE" },
            turns: {
              type: "array",
              items: { $ref: "#/components/schemas/ConversationTurn" },
            },
          },
        },
        ClarificationOption: {
          type: "object",
          properties: {
            id: { type: "string", example: "steam:588430" },
            label: { type: "string", example: "Fallout Shelter on Steam" },
            subtitle: { type: "string", example: "Installed locally at C:\\Program Files (x86)\\Steam..." },
            confidence: { type: "number", example: 0.95 },
            description: { type: "string", example: "Launches the Steam local version of Fallout Shelter." },
          },
        },
        ClarificationRequest: {
          type: "object",
          properties: {
            requestId: { type: "string", example: "a4387d8d-2a14-4fb9-a9a3-9cb315cf3ba5" },
            type: { type: "string", example: "AMBIGUOUS_TARGET" },
            reason: { type: "string", example: "Multiple games found matching your request." },
            entityType: { type: "string", example: "GAME" },
            originalQuery: { type: "string", example: "Launch Fallout Shelter" },
            candidates: {
              type: "array",
              items: { $ref: "#/components/schemas/ClarificationOption" },
            },
            id: { type: "string", example: "clarify_game_launch" },
            question: { type: "string", example: "I found multiple titles matching 'Fallout Shelter'. Which one would you like me to launch?" },
            options: {
              type: "array",
              items: { $ref: "#/components/schemas/ClarificationOption" },
            },
            allowFreeText: { type: "boolean", example: true },
          },
        },
        ConversationTurn: {
          type: "object",
          properties: {
            requestId: { type: "string", example: "a4387d8d-2a14-4fb9-a9a3-9cb315cf3ba5" },
            timestamp: { type: "string", format: "date-time", example: "2026-07-05T20:55:00.000Z" },
            userMessage: { type: "string", example: "Launch Fallout Shelter" },
            assistantResponse: {
              type: "object",
              properties: {
                success: { type: "boolean", example: true },
                message: { type: "string", example: "AI Layer Ready" },
              },
            },
            intentPlanId: { type: "string", example: "intent-f8f901c" },
            executionPlanId: { type: "string", nullable: true, example: "exec-721c5f8" },
            summary: { type: "string", example: "Successfully executed intents: LaunchGame" },
            referencesCreated: { type: "array", items: { type: "string" }, example: ["Fallout Shelter"] },
          },
        },
        ConversationSession: {
          type: "object",
          properties: {
            sessionId: { type: "string", example: "e10b10db-8421-4dca-2a3e-5c9a721c5f8f" },
            userId: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
            status: { type: "string", enum: ["ACTIVE", "WAITING_FOR_CLARIFICATION", "EXPIRED", "CLOSED"], example: "ACTIVE" },
            createdAt: { type: "string", format: "date-time", example: "2026-07-04T10:00:00Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-07-05T20:55:00.000Z" },
            expiresAt: { type: "string", format: "date-time", example: "2026-07-05T21:25:00.000Z" },
            turns: { type: "array", items: { $ref: "#/components/schemas/ConversationTurn" } },
            pendingClarification: { $ref: "#/components/schemas/ClarificationRequest", nullable: true },
          },
        },
        MemoryEntry: {
          type: "object",
          properties: {
            id: { type: "string", example: "mem_64b0f8" },
            userId: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
            type: { type: "string", enum: ["ENTITY_ALIAS", "USER_PREFERENCE", "CONVERSATION", "LEARNING", "CUSTOM"], example: "ENTITY_ALIAS" },
            key: { type: "string", example: "Fallout Sheltr" },
            value: { type: "string", example: "Fallout Shelter" },
            confidence: { type: "number", example: 1.0 },
            source: { type: "string", example: "LEARNING" },
            createdAt: { type: "string", format: "date-time", example: "2026-07-05T20:55:00Z" },
            updatedAt: { type: "string", format: "date-time", example: "2026-07-05T20:55:00Z" },
            lastUsedAt: { type: "string", format: "date-time", example: "2026-07-05T20:55:00Z" },
            usageCount: { type: "integer", example: 1 },
          },
        },
        ToolExecutionResult: {
          type: "object",
          properties: {
            stepId: { type: "string", example: "step-1" },
            tool: { type: "string", example: "launchLocalGame" },
            status: { type: "string", example: "SUCCESS" },
            duration: { type: "number", example: 250 },
            input: {
              type: "object",
              properties: {
                gameId: { type: "string", example: "64b0f4fa9c0d12e098a5e3f9" },
              },
            },
            output: {
              type: "object",
              properties: {
                pid: { type: "integer", example: 12840 },
                processName: { type: "string", example: "FalloutShelter.exe" },
              },
            },
            error: { type: "string", nullable: true, example: null },
            warnings: { type: "array", items: { type: "string" }, example: [] },
            retryCount: { type: "integer", example: 0 },
          },
        },
        ExecutionResult: {
          type: "object",
          properties: {
            executionId: { type: "string", example: "exec-721c5f8" },
            status: { type: "string", example: "SUCCESS" },
            startedAt: { type: "string", format: "date-time", example: "2026-07-05T20:55:00.000Z" },
            finishedAt: { type: "string", format: "date-time", example: "2026-07-05T20:55:00.250Z" },
            steps: {
              type: "array",
              items: { $ref: "#/components/schemas/ToolExecutionResult" },
            },
            summary: { type: "string", example: "Successfully launched Fallout Shelter locally." },
            errors: { type: "array", items: { type: "string" }, example: [] },
            warnings: { type: "array", items: { type: "string" }, example: [] },
          },
        },
        RuntimeProfilerMetrics: {
          type: "object",
          properties: {
            planningDurationMs: { type: "number", example: 45 },
            executionDurationMs: { type: "number", example: 250 },
            conversationDurationMs: { type: "number", example: 10 },
            memoryDurationMs: { type: "number", example: 5 },
            clarificationDurationMs: { type: "number", example: 2 },
            entityResolutionDurationMs: { type: "number", example: 15 },
            toolDurationsMs: {
              type: "object",
              additionalProperties: { type: "number" },
              example: { launchLocalGame: 250 },
            },
            overallRuntimeMs: { type: "number", example: 327 },
          },
        },

        // --- ERROR SCHEMAS ---
        ValidationError: {
          type: "object",
          properties: {
            Status: { type: "string", example: "Fail" },
            error: { type: "string", example: "Username and password are required" },
          },
        },
        UnauthorizedError: {
          type: "object",
          properties: {
            Status: { type: "string", example: "Fail" },
            error: { type: "string", example: "Unauthorized access: Invalid or expired authentication token" },
          },
        },
        ForbiddenError: {
          type: "object",
          properties: {
            Status: { type: "string", example: "Fail" },
            error: { type: "string", example: "Access Denied: You do not have permission to access this resource" },
          },
        },
        NotFoundError: {
          type: "object",
          properties: {
            Status: { type: "string", example: "Fail" },
            error: { type: "string", example: "no value found" },
          },
        },
        ConflictError: {
          type: "object",
          properties: {
            Status: { type: "string", example: "Fail" },
            error: { type: "string", example: "Game already exists in library" },
          },
        },
        InternalServerError: {
          type: "object",
          properties: {
            Status: { type: "string", example: "Fail" },
            error: { type: "string", example: "Internal Server Error" },
          },
        },
        AIExecutionError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Failed to launch game: executable path not found." },
            errors: { type: "array", items: { type: "string" }, example: ["Executable path empty"] },
          },
        },
        ClarificationRequiredResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            status: { type: "string", example: "CLARIFICATION_REQUIRED" },
            clarificationRequest: { $ref: "#/components/schemas/ClarificationRequest" },
          },
        },
      },
    },
    paths: {
      // ==========================================
      // HEALTH / SYSTEM ENDPOINTS
      // ==========================================
      "/health": {
        get: {
          tags: ["Administration"],
          summary: "System Health Check",
          description: "Returns the health and status of the RoninArc backend server.",
          operationId: "healthCheck",
          responses: {
            200: {
              description: "Server is healthy.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "ok" },
                      message: { type: "string", example: "RoninArc was healthy " },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ==========================================
      // AUTHENTICATION & USERS
      // ==========================================
      "/auth/register": {
        post: {
          tags: ["Authentication"],
          summary: "Register new user",
          description: "Creates a new user account profile in the RoninArc database.",
          operationId: "register",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RegisterRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "User registered successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: {
                        type: "object",
                        properties: {
                          username: { type: "string", example: "antigravity" },
                          email: { type: "string", example: "antigravity@gemini.com" },
                          id: { type: "string", example: "64b0f3e69c0d12e098a5e3f1" },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: "Validation failure (username or password missing/invalid).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            409: {
              description: "Conflict: username already taken.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ConflictError" } } },
            },
            500: {
              description: "Server failure.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/InternalServerError" } } },
            },
          },
        },
      },
      "/auth/login": {
        post: {
          tags: ["Authentication"],
          summary: "Authenticate user",
          description: "Verifies user credentials and returns tokens (JWT Access Token & Refresh Token).",
          operationId: "login",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Log in successful.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } },
            },
            400: {
              description: "Validation failure (missing username or password).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            401: {
              description: "Authentication failed (invalid credentials).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } },
            },
            500: {
              description: "Server failure.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/InternalServerError" } } },
            },
          },
        },
      },
      "/auth/refresh": {
        post: {
          tags: ["Authentication"],
          summary: "Refresh access token",
          description: "Accepts a valid refresh token and issues a new access token and refresh token rotation.",
          operationId: "refreshToken",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["refreshToken"],
                  properties: {
                    refreshToken: { type: "string", example: "d7515fc3-8472-4d7a-b9c1-5fb901cebfd1" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Tokens rotated successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: {
                        type: "object",
                        properties: {
                          accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                          refreshToken: { type: "string", example: "d7515fc3-8472-4d7a-b9c1-5fb901cebfd1" },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: "Validation failure (missing refresh token).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            401: {
              description: "Invalid or expired refresh token.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } },
            },
          },
        },
      },
      "/auth/logout": {
        post: {
          tags: ["Authentication"],
          summary: "Log out user",
          description: "Revokes the active refresh token and cleans up user session.",
          operationId: "logout",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["refreshToken"],
                  properties: {
                    refreshToken: { type: "string", example: "d7515fc3-8472-4d7a-b9c1-5fb901cebfd1" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Logged out successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Message: { type: "string", example: "Logged out successfully" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Validation failure (missing refresh token).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
          },
        },
      },
      "/auth/me": {
        get: {
          tags: ["Users"],
          summary: "Get current user profile",
          description: "Returns the authenticated user details from the JWT credentials.",
          operationId: "getCurrentUser",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Profile retrieved successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
            401: {
              description: "Unauthorized.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } },
            },
          },
        },
      },
      "/auth/change-password": {
        patch: {
          tags: ["Users"],
          summary: "Change account password",
          description: "Updates the authenticated user password after validating the old password.",
          operationId: "changePassword",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChangePasswordRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Password changed successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Message: { type: "string", example: "Password changed successfully" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Missing password input parameters or incorrect old password.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            401: {
              description: "Unauthorized.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } },
            },
          },
        },
      },
      "/auth/account": {
        delete: {
          tags: ["Users"],
          summary: "Delete user account",
          description: "Permanently deletes the authenticated user profile and all nested library data.",
          operationId: "deleteAccount",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeleteAccountRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Account deleted successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Message: { type: "string", example: "Account deleted successfully" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Password confirmation required.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            401: {
              description: "Incorrect password verification or unauthorized.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } },
            },
          },
        },
      },
      "/auth/logout-all": {
        post: {
          tags: ["Authentication"],
          summary: "Force logout all devices",
          description: "Invalidates all active refresh tokens for the authenticated user.",
          operationId: "logoutAllDevices",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Logged out from all devices.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Message: { type: "string", example: "Logged out from all devices" },
                    },
                  },
                },
              },
            },
            401: {
              description: "Unauthorized.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } },
            },
          },
        },
      },

      // ==========================================
      // GAME LIBRARY
      // ==========================================
      "/game": {
        get: {
          tags: ["Library"],
          summary: "Get user library games",
          description: "Fetches all games stored in the authenticated user's game library catalog.",
          operationId: "getLibrary",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Games list fetched.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { type: "array", items: { $ref: "#/components/schemas/GameLibrary" } },
                    },
                  },
                },
              },
            },
            401: {
              description: "Unauthorized.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } },
            },
          },
        },
      },
      "/game/add": {
        post: {
          tags: ["Library"],
          summary: "Add new game to library",
          description: "Manually inserts or matches a new game title to the library catalog, attaching metadata attributes.",
          operationId: "addGame",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AddGameRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Game added successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/GameLibrary" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Missing or invalid payload parameters.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            401: {
              description: "Unauthorized.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } },
            },
          },
        },
      },
      "/game/filter/search": {
        get: {
          tags: ["Library"],
          summary: "Filter library games dynamic search",
          description: "Queries the library catalog filtering by parameters (title, tags, progressStatus).",
          operationId: "filterLibraryGames",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "param",
              in: "query",
              required: true,
              description: "The library field to query (title, tags, status, or progressStatus).",
              schema: { type: "string", enum: ["title", "tags", "status", "progressStatus"] },
            },
            {
              name: "value",
              in: "query",
              required: true,
              description: "Search filter string.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Filtered games array.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { type: "array", items: { $ref: "#/components/schemas/GameLibrary" } },
                    },
                  },
                },
              },
            },
            400: {
              description: "Invalid filter param or empty value.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            404: {
              description: "No games found matching criteria.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } },
            },
          },
        },
      },
      "/game/{gameid}": {
        get: {
          tags: ["Library"],
          summary: "Get game library entry by ID",
          description: "Fetches complete catalog details for a single game in the user's library.",
          operationId: "getGameById",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameid",
              in: "path",
              required: true,
              description: "MongoDB ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Game details retrieved.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/GameLibrary" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Invalid game id format.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            404: {
              description: "Game entry not found.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } },
            },
          },
        },
        patch: {
          tags: ["Library"],
          summary: "Update game library details",
          description: "Updates parameters like tags, executable path, or progress status for a game.",
          operationId: "updateLibraryGame",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameid",
              in: "path",
              required: true,
              description: "MongoDB ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateGameRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Game updated successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/GameLibrary" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Invalid updates format.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            404: {
              description: "Game not found.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } },
            },
          },
        },
        delete: {
          tags: ["Library"],
          summary: "Delete game from library",
          description: "Removes a game entry from the user library catalog.",
          operationId: "deleteLibraryGame",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameid",
              in: "path",
              required: true,
              description: "MongoDB ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Game deleted successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/GameLibrary" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Invalid game id format.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
            404: {
              description: "Game not found.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/NotFoundError" } } },
            },
          },
        },
      },
      "/game/{gameid}/enrich": {
        post: {
          tags: ["Library"],
          summary: "Enrich game metadata",
          description: "Manually triggers background sync metadata lookup (screenshots, trailers, website, rating) for a game via RAWG API.",
          operationId: "enrichGame",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameid",
              in: "path",
              required: true,
              description: "MongoDB ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Metadata enriched successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/GameLibrary" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Invalid game id.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
          },
        },
      },

      // ==========================================
      // RAWG SEARCH
      // ==========================================
      "/rawg/search": {
        get: {
          tags: ["RAWG"],
          summary: "Search game from RAWG",
          description: "Performs query search against remote RAWG catalog database.",
          operationId: "searchRAWGGames",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "query",
              in: "query",
              required: true,
              description: "Text search matching game titles.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "RAWG search results array.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { type: "array", items: { $ref: "#/components/schemas/RAWGGameDetails" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/rawg/{rawgId}": {
        get: {
          tags: ["RAWG"],
          summary: "Get RAWG game details by ID",
          description: "Fetches full metadata details from RAWG database matching the RAWG ID.",
          operationId: "getRAWGGameDetails",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "rawgId",
              in: "path",
              required: true,
              description: "RAWG integer ID.",
              schema: { type: "integer" },
            },
          ],
          responses: {
            200: {
              description: "Game details from RAWG.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/RAWGGameDetails" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ==========================================
      // DASHBOARD
      // ==========================================
      "/dashboard/stats": {
        get: {
          tags: ["Dashboard"],
          summary: "Get dashboard statistics",
          description: "Retrieves counters and statistics (total games, play times, backlog status) for the dashboard widgets.",
          operationId: "getDashboardStats",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Stats collected.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/DashboardStats" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ==========================================
      // REVIEWS
      // ==========================================
      "/review/{gameId}": {
        get: {
          tags: ["Reviews"],
          summary: "Get user review for a game",
          description: "Fetches the existing review, notes, and rating for a specific game library ID.",
          operationId: "getReview",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameId",
              in: "path",
              required: true,
              description: "ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Review object.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/Review" },
                    },
                  },
                },
              },
            },
            500: {
              description: "Error response fetching review.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Failed" },
                      Message: { type: "string", example: "Failed to fetch review" },
                    },
                  },
                },
              },
            },
          },
        },
        put: {
          tags: ["Reviews"],
          summary: "Upsert user review for a game",
          description: "Creates a new review or updates an existing review rating and commentary text.",
          operationId: "upsertReview",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameId",
              in: "path",
              required: true,
              description: "ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReviewUpsertRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Review upserted successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/Review" },
                    },
                  },
                },
              },
            },
            500: {
              description: "Error response saving review.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Failed" },
                      Message: { type: "string", example: "Failed to save review" },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Reviews"],
          summary: "Delete user review for a game",
          description: "Removes review score and text comments associated with the library game.",
          operationId: "deleteReview",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameId",
              in: "path",
              required: true,
              description: "ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Review deleted successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Message: { type: "string", example: "Review deleted" },
                    },
                  },
                },
              },
            },
            500: {
              description: "Error response deleting review.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Failed" },
                      Message: { type: "string", example: "Failed to delete review" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ==========================================
      // COLLECTIONS
      // ==========================================
      "/collection": {
        get: {
          tags: ["Collections"],
          summary: "Get user collections list",
          description: "Retrieves all custom folders/collections defined by the authenticated user.",
          operationId: "getCollections",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Collections list.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { type: "array", items: { $ref: "#/components/schemas/Collection" } },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ["Collections"],
          summary: "Create custom collection",
          description: "Initializes a blank collection folder with a custom label name and optional description text.",
          operationId: "createCollection",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateCollectionRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Collection created.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/Collection" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Missing name or invalid structure.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Failed" },
                      Message: { type: "string", example: "Collection name is required" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/collection/{collectionId}": {
        get: {
          tags: ["Collections"],
          summary: "Get collection by ID",
          description: "Fetches specific collection folder details including list of grouped library game IDs.",
          operationId: "getCollectionById",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "collectionId",
              in: "path",
              required: true,
              description: "ObjectID of the collection.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Collection details.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/Collection" },
                    },
                  },
                },
              },
            },
            404: {
              description: "Collection not found.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Failed" },
                      Message: { type: "string", example: "Collection not found" },
                    },
                  },
                },
              },
            },
          },
        },
        patch: {
          tags: ["Collections"],
          summary: "Update collection metadata",
          description: "Edits custom name or description elements for the collection folder.",
          operationId: "updateCollection",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "collectionId",
              in: "path",
              required: true,
              description: "ObjectID of the collection.",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateCollectionRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Collection updated successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/Collection" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Update failure validation error.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Failed" },
                      Message: { type: "string", example: "Unknown error" },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Collections"],
          summary: "Delete custom collection",
          description: "Permanently deletes the custom collection (does not delete mapped games).",
          operationId: "deleteCollection",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "collectionId",
              in: "path",
              required: true,
              description: "ObjectID of the collection.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Collection deleted.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Message: { type: "string", example: "Collection deleted" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/collection/{collectionId}/games": {
        post: {
          tags: ["Collections"],
          summary: "Add game to collection",
          description: "Appends a library game reference ID inside a collection's list.",
          operationId: "addGameToCollection",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "collectionId",
              in: "path",
              required: true,
              description: "ObjectID of the collection.",
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AddGameToCollectionRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Game added successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/Collection" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/collection/{collectionId}/games/{gameId}": {
        delete: {
          tags: ["Collections"],
          summary: "Remove game from collection",
          description: "Deletes the library game mapping reference from within a collection catalog list.",
          operationId: "removeGameFromCollection",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "collectionId",
              in: "path",
              required: true,
              description: "ObjectID of the collection.",
              schema: { type: "string" },
            },
            {
              name: "gameId",
              in: "path",
              required: true,
              description: "ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Game removed successfully from collection.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/Collection" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ==========================================
      // PLAY SESSIONS
      // ==========================================
      "/play-session/start/{gameId}": {
        post: {
          tags: ["Launcher"],
          summary: "Start new play session",
          description: "Registers start timestamp tracking session for a library game.",
          operationId: "startPlaySession",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameId",
              in: "path",
              required: true,
              description: "ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Play session document initialized.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/PlaySession" },
                    },
                  },
                },
              },
            },
            400: {
              description: "Invalid ID or concurrent session mismatch.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
            },
          },
        },
      },
      "/play-session/end/{gameId}": {
        post: {
          tags: ["Launcher"],
          summary: "End active play session",
          description: "Calculates total play duration minutes and sets end timestamp to finalize game play tracking.",
          operationId: "endPlaySession",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameId",
              in: "path",
              required: true,
              description: "ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Play session document finalized.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/PlaySession" },
                    },
                  },
                },
              },
            },
            404: {
              description: "No active session found matching criteria.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Failed" },
                      Message: { type: "string", example: "No active session found" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/play-session/recent": {
        get: {
          tags: ["Launcher"],
          summary: "Get recent play sessions list",
          description: "Fetches user's finished play history sessions ordered by recency.",
          operationId: "getRecentPlaySessions",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              description: "Page size threshold. Minimum 1, Maximum 50.",
              schema: { type: "integer", default: 10 },
            },
          ],
          responses: {
            200: {
              description: "Sessions history array.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { type: "array", items: { $ref: "#/components/schemas/PlaySession" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/play-session/stats": {
        get: {
          tags: ["Dashboard"],
          summary: "Get overall playtime statistics",
          description: "Aggregates total session duration minutes and ranks games by cumulative playtime.",
          operationId: "getPlaytimeStats",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Aggregated stats payload.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/PlaytimeStats" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/play-session/game/{gameId}": {
        get: {
          tags: ["Launcher"],
          summary: "Get playtime stats for a single game",
          description: "Accumulates total play minutes and lists previous sessions details for a single game library ID.",
          operationId: "getGamePlaytimeStats",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameId",
              in: "path",
              required: true,
              description: "ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Game playtime stats object.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/GamePlaytimeStats" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ==========================================
      // PROVIDERS (Epic & Steam)
      // ==========================================
      "/provider/installations/refresh": {
        post: {
          tags: ["Providers"],
          summary: "Refresh provider installations",
          description: "Syncs locally installed client executable applications list with user library mapping.",
          operationId: "refreshInstallations",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RefreshInstallationsRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Reports generated for sync status.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: {
                        type: "object",
                        description: "Map of sync reports by provider ID.",
                        example: {
                          steam: { installedCount: 5, syncedCount: 3 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/provider/{providerId}/status": {
        get: {
          tags: ["Providers"],
          summary: "Get provider connection status",
          description: "Retrieves integration details (connection status, displayName, game count) for a provider.",
          operationId: "getProviderStatus",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "providerId",
              in: "path",
              required: true,
              description: "Identity key for game provider.",
              schema: { type: "string", enum: ["epic", "steam"] },
            },
          ],
          responses: {
            200: {
              description: "Status payload.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/ProviderStatus" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/provider/{providerId}/connect": {
        post: {
          tags: ["Providers"],
          summary: "Connect provider accounts",
          description: "Hooks user accounts with EPIC authorization code exchange or lists STEAM local applications config.",
          operationId: "connectProvider",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "providerId",
              in: "path",
              required: true,
              description: "Identity key for game provider.",
              schema: { type: "string", enum: ["epic", "steam"] },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/EpicConnectRequest" },
                    { $ref: "#/components/schemas/SteamConnectRequest" },
                  ],
                },
              },
            },
          },
          responses: {
            200: {
              description: "Connected successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: {
                        type: "object",
                        properties: {
                          connected: { type: "boolean", example: true },
                          displayName: { type: "string", example: "Local Steam" },
                          totalGames: { type: "integer", example: 5 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/provider/{providerId}/disconnect": {
        delete: {
          tags: ["Providers"],
          summary: "Disconnect provider integrations",
          description: "Unsets third-party account linkages in profile settings and resets mapped ownership tags.",
          operationId: "disconnectProvider",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "providerId",
              in: "path",
              required: true,
              description: "Identity key for game provider.",
              schema: { type: "string", enum: ["epic", "steam"] },
            },
          ],
          responses: {
            200: {
              description: "Disconnected successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/provider/{providerId}/resync": {
        post: {
          tags: ["Providers"],
          summary: "Resync provider games",
          description: "Re-triggers background batch catalog mapping matching current lists of local applications or cloud profiles.",
          operationId: "resyncProvider",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "providerId",
              in: "path",
              required: true,
              description: "Identity key for game provider.",
              schema: { type: "string", enum: ["epic", "steam"] },
            },
          ],
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    localGames: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Re-synchronized successfully.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: {
                        type: "object",
                        properties: {
                          imported: { type: "integer", example: 3 },
                          totalGames: { type: "integer", example: 12 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/provider/{providerId}/oauth/start": {
        get: {
          tags: ["Providers"],
          summary: "Start Epic OAuth login URL generation",
          description: "Returns redirect callback URL address to start authorized EPIC login redirect sequence.",
          operationId: "startOAuthFlow",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "providerId",
              in: "path",
              required: true,
              description: "Identity key (epic only).",
              schema: { type: "string", enum: ["epic"] },
            },
          ],
          responses: {
            200: {
              description: "Login URL generated.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: {
                        type: "object",
                        properties: {
                          loginUrl: { type: "string", example: "https://www.epicgames.com/id/authorize?..." },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              description: "OAuth not supported for this provider.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Failed" },
                      Message: { type: "string", example: "OAuth not supported for this provider" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ==========================================
      // ACTIVITY
      // ==========================================
      "/activity": {
        get: {
          tags: ["Launcher"],
          summary: "Get user activities feed",
          description: "Retrieves sorted activity notifications log (such as review edits, launches, and collection changes).",
          operationId: "getUserActivities",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Activities list.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { type: "array", items: { $ref: "#/components/schemas/Activity" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/activity/launch/{gameId}": {
        post: {
          tags: ["Launcher"],
          summary: "Record game launch activity log",
          description: "Registers game launch activity event and appends tracking counters.",
          operationId: "recordLaunchActivity",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "gameId",
              in: "path",
              required: true,
              description: "ObjectID of the library game.",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Launch recorded.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      Status: { type: "string", example: "Success" },
                      Data: { $ref: "#/components/schemas/Activity" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ==========================================
      // AI MODULE (CO-PILOT AGENT)
      // ==========================================
      "/ai/chat": {
        post: {
          tags: ["AI"],
          summary: "Interact with RoninArc AI Assistant co-pilot",
          description: `Accepts a natural language user query input and routes it through the AI runtime orchestration layer.

### Workflow & Outcomes:
1. **Immediate Execution Plan**:
   - If the intent is unambiguous (e.g., *"Launch Fallout Shelter"*), the AI compiles tool workflows, runs them, and completes the action instantly.
2. **Clarification Required**:
   - If an entity name is ambiguous or incomplete (e.g., *"Launch Fallout Sheltr"* or *"Create a Souls collection"* when multiple exist), the AI pauses execution and returns a \`CLARIFICATION_REQUIRED\` state with a list of resolved candidate options.
3. **Conversation Resume**:
   - If the user responds to a clarification question, the AI parses the choice selection, reconstructs the planning intent, and resumes execution seamlessly.
4. **Memory Retrieval & Learned Aliases**:
   - The AI co-pilot queries a localized preference and alias memory store (e.g., matching custom nicknames to official launcher paths).
5. **Runtime Profiling Metrics**:
   - Automatically tracks computation layers and tool execution durations.

### Natural Language Examples to Try:
- *"Launch Fallout Shelter"*
- *"Mark Elden Ring completed"*
- *"Rate Hades 9"*
- *"Write a review for Hollow Knight: Beautiful game"*
- *"Create a Souls collection"*
- *"Sync Epic library"*
- *"What should I play next?"*
- *"How many games have I completed?"*`,
          operationId: "chatWithAI",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AIRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "AI operation completed successfully, clarification required, or resumed action outcome.",
              content: {
                "application/json": {
                  schema: {
                    oneOf: [
                      {
                        description: "AI executed intent plan successfully.",
                        allOf: [
                          { $ref: "#/components/schemas/AIResponse" },
                          {
                            type: "object",
                            properties: {
                              success: { type: "boolean", example: true },
                              message: { type: "string", example: "Successfully launched Fallout Shelter locally." },
                            },
                          },
                        ],
                      },
                      {
                        description: "Ambiguity detected. Clarification choice required from the client.",
                        $ref: "#/components/schemas/ClarificationRequiredResponse",
                      },
                      {
                        description: "Clarification timed out or cancelled by user.",
                        allOf: [
                          {
                            type: "object",
                            properties: {
                              success: { type: "boolean", example: false },
                              status: { type: "string", example: "CANCELLED" },
                              message: { type: "string", example: "Clarification request cancelled by the user." },
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            },
            401: {
              description: "Unauthorized access token.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/UnauthorizedError" } } },
            },
            500: {
              description: "AI runtime or execution engine pipeline error.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/AIExecutionError" } } },
            },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = options.definition;
export default swaggerSpec;
