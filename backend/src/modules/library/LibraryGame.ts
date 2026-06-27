import mongoose from "mongoose";

export interface IProviderOwnership {
  providerGameId: string;
  providerTitle?: string;
  owned?: boolean;
  installed?: boolean;
  launcher?: string;
  installPath?: string;
  manifestId?: string;
  executable?: string;
  syncedAt: Date;
}

export interface IMetadataState {
  status: "none" | "pending" | "enriching" | "complete" | "failed";
  lastAttempt?: Date;
  lastSuccess?: Date;
  lastError?: string;
}

export interface IGameArtwork {
  selectedSource: "manual" | "rawg" | "epic" | "steam" | "gog" | "ea" | "ubisoft" | "xbox";
  sources: Record<string, string>;
}

export interface IGameLibrary extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  rawgId?: number | null;
  title: string;
  description: string;
  tags: string[];
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
  rawgRating: number;
  metacritic?: number | null;
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
    artwork: {
      selectedSource: {
        type: String,
        enum: ["manual", "rawg", "epic", "steam", "gog", "ea", "ubisoft", "xbox"],
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
    rawgRating: {
      type: Number,
      default: 0,
    },
    metacritic: {
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

const gameLibrarymodel = mongoose.model<IGameLibrary>(
  "GameLibrary",
  gameLibraryschema,
);

export default gameLibrarymodel;

