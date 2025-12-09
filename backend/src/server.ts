import app from "./app";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const ATLAS_URI = process.env.Atlas_URL;
const PORT = process.env.PORT||5000;

const connectDB = async () => {
  try {
    let uri = ATLAS_URI;
    if (!uri) {
      console.error("MongoDB Atlas URI is missing, check your env file...");
      process.exit(1);
    }

    await mongoose.connect(uri);
    console.log("Mongo DB connected : and running in:" + uri);
  } catch (error) {
    console.error("MongoDB is failing" + error);
    process.exit(1);
  }
};

const startserver = async() => {
    await connectDB();
    app.listen(PORT,()=>{console.log(`Server is up and running on port:${PORT}`)});

}

startserver();