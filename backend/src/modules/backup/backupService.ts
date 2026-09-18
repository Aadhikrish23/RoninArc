import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import { getAtlasConnection } from "./atlasConnection";
import AppError from "../../shared/errors/AppError";
import User from "../auth/models/User";
import gameLibrarymodel from "../library/LibraryGame";
import Note from "../notes/Notemodel";
import Activity from "../activity/ActivityModel";
import Review from "../review/Reviewmodel";
import Collection from "../collection/CollectionModel";
import PlaySession from "../playSession/PlaySessionModel";
import EpicOwnership from "../providers/epic/models/EpicOwnership";

// Every user-scoped collection that gets mirrored to Atlas. RefreshToken is
// deliberately excluded -- sessions are per-device and restoring old ones
// from the cloud would be meaningless (and a minor security smell).
const USER_SCOPED_MODELS: mongoose.Model<any>[] = [
  gameLibrarymodel,
  Note,
  Activity,
  Review,
  Collection,
  PlaySession,
  EpicOwnership,
];

/**
 * Returns a model bound to the Atlas connection that reuses the exact same
 * schema as the local model -- no schema duplication, no drift risk.
 */
async function atlasModelFor(localModel: mongoose.Model<any>) {
  const atlas = await getAtlasConnection();
  return atlas.models[localModel.modelName] || atlas.model(localModel.modelName, localModel.schema);
}

/**
 * One-way mirror: local -> Atlas, for a single user's data. Never reads
 * from Atlas. Safe to call repeatedly (upserts by _id).
 */
async function backupUser(userId: string) {
  const localUser = await User.findById(userId).lean();
  if (!localUser) {
    throw new AppError("User not found", 404);
  }

  const atlasUserModel = await atlasModelFor(User);
  await atlasUserModel.findByIdAndUpdate(localUser._id, localUser, {
    upsert: true,
    setDefaultsOnInsert: true,
  });

  let documents = 0;
  for (const model of USER_SCOPED_MODELS) {
    const atlasModel = await atlasModelFor(model);
    const docs = await model.find({ userId }).lean();

    for (const doc of docs) {
      await atlasModel.findByIdAndUpdate(doc._id, doc, {
        upsert: true,
        setDefaultsOnInsert: true,
      });
    }
    documents += docs.length;
  }

  return { collections: USER_SCOPED_MODELS.length, documents };
}

/**
 * Backs up every user that currently exists in the local database. Used by
 * the periodic auto-backup, which has no single "current user" to key off.
 */
async function backupAllUsers() {
  const users = await User.find({}, { _id: 1 }).lean();
  let backedUp = 0;

  for (const user of users) {
    try {
      await backupUser(user._id.toString());
      backedUp++;
    } catch (error: any) {
      console.error(`[Backup] Failed to back up user ${user._id}:`, error.message || error);
    }
  }

  return { users: backedUp };
}

/**
 * Pulls a user's full backup down from Atlas into the local database.
 * Only for a device that doesn't have this account locally yet -- this is
 * the pre-login "Restore from Cloud" flow, not a merge.
 */
async function restoreByCredentials(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();

  const atlasUserModel = await atlasModelFor(User);
  const remoteUser = await atlasUserModel.findOne({ username: normalizedUsername });

  if (!remoteUser) {
    throw new AppError("No cloud backup found for this account.", 404);
  }

  const passwordMatch = await bcryptjs.compare(password, remoteUser.passwordHash);
  if (!passwordMatch) {
    throw new AppError("Invalid credentials", 401);
  }

  const existingLocal = await User.findById(remoteUser._id);
  if (existingLocal) {
    throw new AppError(
      "This account already exists on this device. Just log in normally.",
      409,
    );
  }

  await User.create(remoteUser.toObject());

  let documents = 0;
  for (const model of USER_SCOPED_MODELS) {
    const atlasModel = await atlasModelFor(model);
    const docs = await atlasModel.find({ userId: remoteUser._id }).lean();

    if (docs.length > 0) {
      const results = await model.collection.insertMany(docs, { ordered: false }).catch((err: any) => {
        console.error(`[Restore] Some ${model.modelName} documents failed to insert:`, err.message || err);
        return null;
      });
      documents += results?.insertedCount ?? 0;
    }
  }

  return { username: remoteUser.username, documents };
}

export default {
  backupUser,
  backupAllUsers,
  restoreByCredentials,
};
