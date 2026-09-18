import app from "./app";
import mongoose from "mongoose";
import dotenv from "dotenv";
import backupService from "./modules/backup/backupService";

dotenv.config();

// MONGO_URI takes precedence when set -- this is how the packaged Electron
// app points the backend at its bundled, embedded mongod instance instead
// of the dev-time local server. LOCAL_URL_Mongo stays the normal dev default.
const MONGO_URI = process.env.MONGO_URI || process.env.LOCAL_URL_Mongo;
const PORT = process.env.PORT||5000;

const AUTO_BACKUP_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

const connectDB = async () => {
  try {
    let uri = MONGO_URI;
    if (!uri) {
      console.error("MongoDB URI is missing, check your env file...");
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("Mongo DB connected : and running in:" + uri);
  } catch (error) {
    console.error("MongoDB is failing" + error);
    process.exit(1);
  }
};

function startAutoBackup() {
  if (!process.env.Atlas_URL) {
    return;
  }

  setInterval(() => {
    backupService.backupAllUsers().catch((error: any) => {
      console.error("[Backup] Periodic auto-backup failed:", error.message || error);
    });
  }, AUTO_BACKUP_INTERVAL_MS);
}

const startserver = async() => {
    await connectDB();
    startAutoBackup();
    app.listen(PORT,()=>{console.log(`Server is up and running on port:${PORT}`)});

}

startserver();