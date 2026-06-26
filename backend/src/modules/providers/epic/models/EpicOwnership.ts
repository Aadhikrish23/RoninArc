import mongoose from "mongoose";
export interface EpicOwnershipDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;

  catalogItemId?: string;
  namespace?: string;

  title?: string;
  description?: string;
  productSlug?: string;

  provider: string;

  owned: boolean;
  installed: boolean;

  developer: string;

  imageUrl: string;
  productId: string;
  acquiredAt: Date;
}

const epicOwnershipSchema = new mongoose.Schema<EpicOwnershipDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    catalogItemId: {
      type: String,
      index: true,
    },
    productId: {
      type: String,
      index: true,
    },
    namespace: String,

    title: String,

    provider: {
      type: String,
      default: "epic",
    },

    owned: {
      type: Boolean,
      default: true,
    },

    installed: {
      type: Boolean,
      default: false,
    },
    developer: {
      type: String,
      default: null,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    acquiredAt: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      default: null,
    },

    productSlug: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

epicOwnershipSchema.index(
  {
    userId: 1,
    catalogItemId: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model<EpicOwnershipDocument>(
  "EpicOwnership",
  epicOwnershipSchema,
);
