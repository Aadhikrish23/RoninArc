import mongoose from "mongoose";

interface UserDocument extends mongoose.Document {
  /** Internal unique handle (sync, links). Never typed or shown: people sign in with their email. */
  username: string;
  /** The name shown in the app. Not unique. Older accounts don't have one: their username is it. */
  displayName?: string;
  /** How people sign in. Unique per database (checked in code). PC accounts made before 1.0.3 may lack one. */
  email?: string;
  passwordHash: string;
  tokensValidAfter?: Date;
  /** Cloud: when a phone first signed in to this account (a link code or the phone app). */
  phoneLinkedAt?: Date;

  providers?: {
    epic?: {
      epicAccountId: string;
      displayName: string;
      refreshToken: string;
      accessToken: string;
      accessTokenExpiresAt: Date;
      connectedAt: Date;
      lastSyncAt?: Date;
    };
    steam?: {
      steamId64: string;
      displayName: string;
      connectedAt: Date;
      lastSyncAt?: Date;
    };
  };

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<UserDocument>(
  {
    username: {
      type: String,
      required: [true, "User name is required"],
      minLength: 2,
      maxLength: 200,
      trim: true,
      unique: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      trim: true,
      maxLength: 60,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    /** Cloud: tokens issued before this (a password change or reset) no longer work. */
    tokensValidAfter: {
      type: Date,
    },
    phoneLinkedAt: {
      type: Date,
    },
    providers: {
      epic: {
        type: {
          epicAccountId: String,
          displayName: String,

          refreshToken: String,

          accessToken: String,

          accessTokenExpiresAt: Date,

          connectedAt: Date,

          lastSyncAt: Date,
        },
        // Without an explicit default, Mongoose auto-vivifies a nested object
        // path like this into an empty {} on every document -- making
        // `!!user.providers.epic` (used by getStatus/verifyConnection/etc. to
        // mean "is connected") true for every user, connected or not.
        default: undefined,
      },
      steam: {
        type: {
          steamId64: String,
          displayName: String,
          connectedAt: Date,
          lastSyncAt: Date,
        },
        default: undefined,
      },
    },
  },
  {
    timestamps: true,
  },
);

const usermodel = mongoose.model<UserDocument>("User", userSchema);

/** What the app calls this person: their display name, or (older accounts) their username. */
export function displayNameOf(user: { displayName?: string | null; username?: string | null } | null | undefined): string {
  return (user?.displayName || user?.username || "").trim();
}

/**
 * One account per email, enforced by the database (not only by a check before saving, which two
 * simultaneous sign-ups can both pass). Case-insensitive, and only for accounts that have an
 * email (older PC accounts don't). If existing data already has duplicates the index can't be
 * built: that is logged, loudly, and the server keeps running with the application-level check.
 */
export async function ensureEmailIndex(): Promise<boolean> {
  try {
    await usermodel.collection.createIndex(
      { email: 1 },
      {
        name: "email_unique_ci",
        unique: true,
        partialFilterExpression: { email: { $type: "string" } },
        collation: { locale: "en", strength: 2 },
      },
    );
    return true;
  } catch (error) {
    console.error(
      "[users] Could not create the unique email index (probably two accounts share an email); sign-ups are still checked in code:",
      error instanceof Error ? error.message : "unknown error",
    );
    return false;
  }
}

export default usermodel;
