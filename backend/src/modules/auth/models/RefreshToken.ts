import mongoose, {
  Document,
  Types,
} from "mongoose";

export interface IRefreshToken
  extends Document {
  userId: Types.ObjectId;

  token: string;

  expiresAt: Date;

  createdAt: Date;

  updatedAt: Date;
}

const refreshTokenSchema =
  new mongoose.Schema<IRefreshToken>(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "User",
      },

      token: {
        type: String,
        required: true,
        unique: true,
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

/**
 * Fast lookup by token
 */
refreshTokenSchema.index({
  token: 1,
});

/**
 * Fast lookup by user
 */
refreshTokenSchema.index({
  userId: 1,
});

/**
 * Mongo automatically removes
 * expired refresh tokens.
 */
refreshTokenSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

export default mongoose.model<IRefreshToken>(
  "RefreshToken",
  refreshTokenSchema
);