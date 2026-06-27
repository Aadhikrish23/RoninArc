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
        epicAccountId: String,
        displayName: String,

        refreshToken: String,

        accessToken: String,

        accessTokenExpiresAt: Date,

        connectedAt: Date,

        lastSyncAt: Date,
      },
      steam: {
        displayName: String,
        connectedAt: Date,
        lastSyncAt: Date,
      },
    },
  },
  {
    timestamps: true,
  },
);

const usermodel = mongoose.model<UserDocument>("User", userSchema);

export default usermodel;
