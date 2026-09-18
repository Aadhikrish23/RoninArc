import mongoose from "mongoose";

interface UserDocument extends mongoose.Document {
  username: string;
  email?: string;
  passwordHash: string;

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
    email: {
      type: String,
    },
    passwordHash: {
      type: String,
      required: true,
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

export default usermodel;
