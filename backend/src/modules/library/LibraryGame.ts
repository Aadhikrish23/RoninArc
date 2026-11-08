import mongoose from "mongoose";
import { tombstonePlugin } from "../sync/tombstonePlugin";

export interface IProviderOwnership {
  providerGameId: string;
  providerTitle?: string;
  owned?: boolean;
  installed?: boolean;
  launcher?: string;
  installPath?: string;
  manifestId?: string;
  executable?: string;
  /** Epic only: what its launcher needs to open a game's install page. */
  namespace?: string;
  appName?: string;
  productSlug?: string;
  syncedAt: Date;
}

export interface IMetadataState {
  status: "none" | "pending" | "enriching" | "complete" | "failed";
  lastAttempt?: Date;
  lastSuccess?: Date;
  lastError?: string;
}

export interface IGameArtwork {
  selectedSource: "manual" | "igdb" | "rawg" | "epic" | "steam" | "gog" | "ea" | "ubisoft" | "xbox";
  sources: Record<string, string>;
}

export interface IGameLibrary extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  rawgId?: number | null;
  /** Never stored in rawgId: the same number means different games on RAWG and IGDB. */
  igdbId?: number | null;
  title: string;
  description: string;
  /** Genres ("RPG"), shown on the game and used for taste. */
  tags: string[];
  /** Play styles ("souls-like", "co-op"), from the game database. Stored so asking never needs a call per game. */
  styleTags: string[];
  artwork: IGameArtwork;
  imageURL?: string;
  developer?: string;
  exePath: string;
  progressStatus: string;

  // Multi-provider ownership
  providers: Record<string, IProviderOwnership>;

  // Legacy fields (migration-only compatibility)
  provider: "manual" | "epic" | "steam" | "gog" | "ea" | "ubisoft" | "xbox";
  providerGameId?: string;
  providerTitle?: string;
  normalizedTitle?: string;
  metadataSyncedAt?: Date;

  // Enrichment fields
  screenshots: string[];
  trailers: string[];
  communityRating: number;
  criticScore?: number | null;
  website?: string;
  playtime?: number;
  developers: string[];
  publishers: string[];

  metadataState: IMetadataState;
  createdAt: Date;
  updatedAt: Date;
}

const gameLibraryschema = new mongoose.Schema<IGameLibrary>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Game title is mandatory"],
    },
    rawgId: {
      type: Number,
      required: false,
      default: null,
    },
    igdbId: {
      type: Number,
      required: false,
      default: null,
    },
    title: {
      type: String,
      required: [true, "Game title is mandatory"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    tags: {
      type: [String],
      default: [],
    },
    styleTags: {
      type: [String],
      default: [],
    },
    artwork: {
      selectedSource: {
        type: String,
        enum: ["manual", "igdb", "rawg", "epic", "steam", "gog", "ea", "ubisoft", "xbox"],
        default: "manual",
      },
      sources: {
        type: Object,
        default: {},
      },
    },
    developer: {
      type: String,
      default: "",
    },
    exePath: {
      type: String,
      default: "",
    },
    progressStatus: {
      type: String,
      enum: ["none", "plan", "playing", "paused", "completed", "dropped"],
      default: "none",
    },

    // Multi-provider ownership
    providers: {
      type: Object,
      default: {},
    },

    // Legacy fields
    provider: {
      type: String,
      enum: ["manual", "epic", "steam", "gog", "ea", "ubisoft", "xbox"],
      default: "manual",
    },
    providerGameId: {
      type: String,
    },
    providerTitle: {
      type: String,
    },
    normalizedTitle: {
      type: String,
    },
    metadataSyncedAt: {
      type: Date,
    },

    // Enrichment fields
    screenshots: {
      type: [String],
      default: [],
    },
    trailers: {
      type: [String],
      default: [],
    },
    communityRating: {
      type: Number,
      default: 0,
    },
    criticScore: {
      type: Number,
      default: null,
    },
    website: {
      type: String,
      default: "",
    },
    playtime: {
      type: Number,
      default: 0,
    },
    developers: {
      type: [String],
      default: [],
    },
    publishers: {
      type: [String],
      default: [],
    },

    metadataState: {
      status: {
        type: String,
        enum: ["none", "pending", "enriching", "complete", "failed"],
        default: "none",
      },
      lastAttempt: { type: Date },
      lastSuccess: { type: Date },
      lastError: { type: String },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

gameLibraryschema.virtual("imageURL").get(function (this: IGameLibrary) {
  return this.artwork?.sources?.[this.artwork?.selectedSource] || "";
});

// Deletions are recorded so sync can pass them on (modules/sync).
gameLibraryschema.plugin(tombstonePlugin, { coll: "games" });

const gameLibrarymodel = mongoose.model<IGameLibrary>(
  "GameLibrary",
  gameLibraryschema,
);

export default gameLibrarymodel;

