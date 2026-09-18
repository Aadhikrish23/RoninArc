import mongoose from "mongoose";
import AppError from "../../shared/errors/AppError";

let atlasConn: mongoose.Connection | null = null;
let atlasConnPromise: Promise<mongoose.Connection> | null = null;

/**
 * Cloud backup/restore uses a second, independent Mongoose connection to
 * Atlas -- the local connection (server.ts) is always the one the rest of
 * the app reads and writes through. Lazily connected so a missing/unset
 * Atlas_URL only breaks backup/restore, never local usage of the app.
 */
export async function getAtlasConnection(): Promise<mongoose.Connection> {
  if (atlasConn) {
    return atlasConn;
  }

  const atlasUri = process.env.Atlas_URL;
  if (!atlasUri) {
    throw new AppError(
      "Cloud backup is not configured: Atlas_URL is missing from the backend environment.",
      500,
    );
  }

  if (!atlasConnPromise) {
    const conn = mongoose.createConnection(atlasUri);
    atlasConnPromise = conn.asPromise().then((ready) => {
      atlasConn = ready;
      return ready;
    });
  }

  return atlasConnPromise;
}
