import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.LOCAL_URL_Mongo || "mongodb://localhost:27017/RoninArc";
const API_URL = "http://localhost:5000";

async function setupDatabase() {
  console.log("Connecting to MongoDB to clean up test data...");
  await mongoose.connect(MONGO_URI);

  // Clean up user, games, and collections for test_ronin
  const User = mongoose.model("User", new mongoose.Schema({ username: String }));
  const GameLibrary = mongoose.model("GameLibrary", new mongoose.Schema({ userId: mongoose.Types.ObjectId, title: String }));
  const Collection = mongoose.model("Collection", new mongoose.Schema({ userId: mongoose.Types.ObjectId, name: String }));

  const testUser = await User.findOne({ username: "test_ronin" });
  if (testUser) {
    console.log(`Found test user: ${testUser._id}. Deleting existing games, collections, and user...`);
    await GameLibrary.deleteMany({ userId: testUser._id });
    await Collection.deleteMany({ userId: testUser._id });
    await User.deleteOne({ _id: testUser._id });
  }

  await mongoose.disconnect();
  console.log("Database clean up finished.");
}

async function runScenarios() {
  try {
    // 1. Clean up & setup DB
    await setupDatabase();

    // 2. Register user
    console.log("\n--- Registering user 'test_ronin' ---");
    const regRes = await axios.post(`${API_URL}/auth/register`, {
      username: "test_ronin",
      password: "password123",
      email: "test_ronin@example.com"
    });
    console.log("Registration Response:", regRes.data);

    // 3. Login
    console.log("\n--- Logging in 'test_ronin' ---");
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: "test_ronin",
      password: "password123"
    });
    const token = loginRes.data.Data.accessToken;
    console.log("Login successful. Token obtained.");

    const client = axios.create({
      baseURL: API_URL,
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // 4. Seed games
    console.log("\n--- Seeding Games in Library ---");
    const seedGames = [
      { rawgId: 1001, title: "Fallout Shelter", tags: ["RPG", "Simulation"], progressStatus: "plan" },
      { rawgId: 1002, title: "Elden Ring", tags: ["RPG", "Action"], progressStatus: "plan" },
      { rawgId: 1003, title: "Fallout 4", tags: ["RPG", "Shooter"], progressStatus: "plan" },
      { rawgId: 1004, title: "Fallout 3", tags: ["RPG", "Shooter"], progressStatus: "plan" }
    ];

    for (const game of seedGames) {
      const addRes = await client.post("/game/add", game);
      console.log(`Added game "${game.title}":`, addRes.data.success || addRes.data.Data ? "SUCCESS" : "FAILED");
    }

    // 5. E2E AI chat scenarios helper
    const sendChat = async (message: string) => {
      console.log(`\n========================================\nUser Query: "${message}"`);
      const response = await client.post("/ai/chat", { message });
      console.log("AI Response:\n", JSON.stringify(response.data, null, 2));
      return response.data;
    };

    // --- Scenario Groups ---

    // Scenario A: Launch Game
    await sendChat("Launch Fallout Shelter");
    await sendChat("Launch Elden Ring");
    await sendChat("Launch Cyberpunk 2077"); // Unknown game
    await sendChat("Launch Fallout"); // Ambiguous (Fallout 4 or Fallout 3)
    await sendChat("Fallout 4"); // Choice selection to resolve clarification!

    // Scenario B: Complete Game
    await sendChat("Complete Fallout Shelter");
    await sendChat("Complete Fallout Shelter"); // Already completed (Idempotent policy)
    await sendChat("Complete Cyberpunk 2077"); // Unknown game

    // Scenario C: Reviews
    await sendChat("Rate Fallout Shelter 9");
    await sendChat("Review Fallout Shelter");
    await sendChat("Update review for Fallout Shelter to 10");

    // Scenario D: Collections
    await sendChat("Create RPG Collection");
    await sendChat("Add Fallout Shelter to RPG Collection");
    await sendChat("Remove Fallout Shelter from RPG Collection");

    // Scenario E: Conversation & Pronoun follow-ups
    await sendChat("Launch Fallout Shelter");
    await sendChat("Rate it 9");
    await sendChat("Add it to RPG Collection");
    await sendChat("Launch it again");

  } catch (error: any) {
    if (error.response) {
      console.error("API Error:", error.response.status, JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Test Error:", error.message || error);
    }
  }
}

runScenarios();
