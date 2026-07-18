import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.LOCAL_URL_Mongo || "mongodb://localhost:27017/RoninArc";
const API_URL = "http://localhost:5000";

async function setupDatabase() {
  console.log("Connecting to MongoDB to clean up test data...");
  await mongoose.connect(MONGO_URI);

  const User = mongoose.model("User", new mongoose.Schema({ username: String }));
  const GameLibrary = mongoose.model("GameLibrary", new mongoose.Schema({ userId: mongoose.Types.ObjectId, title: String }));
  const Collection = mongoose.model("Collection", new mongoose.Schema({ userId: mongoose.Types.ObjectId, name: String }));

  const testUser = await User.findOne({ username: "test_stabilization" });
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
    console.log("\n--- Registering user 'test_stabilization' ---");
    const regRes = await axios.post(`${API_URL}/auth/register`, {
      username: "test_stabilization",
      password: "password123",
      email: "test_stabilization@example.com"
    });
    console.log("Registration Response:", regRes.data);

    // 3. Login
    console.log("\n--- Logging in 'test_stabilization' ---");
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
      username: "test_stabilization",
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
      { rawgId: 1004, title: "Fallout 3", tags: ["RPG", "Shooter"], progressStatus: "plan" },
      { rawgId: 2001, title: "Batman: Arkham Asylum", tags: ["Action", "Adventure"], progressStatus: "plan" },
      { rawgId: 2002, title: "Batman: Arkham City", tags: ["Action", "Adventure"], progressStatus: "plan" },
      { rawgId: 2003, title: "Batman: Arkham Knight", tags: ["Action", "Adventure"], progressStatus: "plan" }
    ];

    for (const game of seedGames) {
      const addRes = await client.post("/game/add", game);
      console.log(`Added game "${game.title}":`, addRes.data.success || addRes.data.Data ? "SUCCESS" : "FAILED");
    }

    const testResults: any[] = [];

    const runQuery = async (category: string, query: string, expectedBehavior: string) => {
      console.log(`\n========================================\n[${category}] User Query: "${query}"`);
      const startTime = Date.now();
      let response;
      try {
        const res = await client.post("/ai/chat", { message: query });
        response = res.data;
      } catch (err: any) {
        response = err.response ? err.response.data : { success: false, message: err.message };
      }
      const duration = Date.now() - startTime;

      console.log("AI Response:\n", JSON.stringify(response, null, 2));

      testResults.push({
        category,
        query,
        expectedBehavior,
        actualBehavior: response.success ? "SUCCESS" : (response.status || "FAILED"),
        duration,
        metrics: response.metrics || {},
        clarificationGenerated: response.clarificationRequest ? "YES" : "NO",
        toolExecuted: response.message || "",
        responseMessage: response.message || response.error || ""
      });

      return response;
    };

    // --- EXECUTE SCENARIOS ---

    // 1. Launch Scenarios
    await runQuery("Launch", "Launch Fallout Shelter", "Launches Fallout Shelter");
    await runQuery("Launch", "Launch Elden Ring", "Launches Elden Ring");
    await runQuery("Launch", "Launch Cyberpunk 2077", "Fails gracefully (not in library)");
    await runQuery("Launch", "Launch Fallout", "Prompts for clarification (Fallout 4 vs Fallout 3)");
    await runQuery("Launch", "Fallout 4", "Resolves clarification to Fallout 4");

    // 2. Completion Scenarios
    await runQuery("Completion", "Complete Fallout Shelter", "Completes Fallout Shelter");
    await runQuery("Completion", "Complete Cyberpunk 2077", "Fails gracefully (not in library)");
    await runQuery("Completion", "Complete it", "Resolves pronoun and completes Fallout 4");

    // 3. Ratings Scenarios
    await runQuery("Ratings", "Rate Fallout Shelter 9", "Rates Fallout Shelter 9");
    await runQuery("Ratings", "Rate it 9", "Resolves pronoun and rates Fallout 4 9");
    await runQuery("Ratings", "Rate Fallout Shelter 10", "Updates Fallout Shelter rating to 10");

    // 4. Reviews Scenarios
    await runQuery("Reviews", "Review Fallout Shelter", "Launches review flow or rates/reviews Fallout Shelter");
    await runQuery("Reviews", "Update review for Fallout Shelter", "Updates review for Fallout Shelter");
    await runQuery("Reviews", "Review it", "Resolves pronoun and reviews Fallout 4");

    // 5. Collections Scenarios
    await runQuery("Collections", "Create RPG Collection", "Creates RPG Collection");
    await runQuery("Collections", "Add Fallout Shelter to RPG Collection", "Adds Fallout Shelter to RPG Collection");
    await runQuery("Collections", "Remove Fallout Shelter from RPG Collection", "Removes Fallout Shelter from RPG Collection");
    await runQuery("Collections", "Create Batman Collection", "Creates Batman Collection");
    // Bulk Operations
    await runQuery("Collections", "Add all Batman games in library to Batman Collection", "Adds all three Batman games sequentially");
    await runQuery("Collections", "Remove all Batman games from Batman Collection", "Removes all three Batman games sequentially");

    // 6. Conversation Memory Flow
    await runQuery("Conversation Memory", "Launch Fallout Shelter", "Launches Fallout Shelter");
    await runQuery("Conversation Memory", "Rate it 9", "Rates Fallout Shelter 9");
    await runQuery("Conversation Memory", "Review it", "Reviews Fallout Shelter");
    await runQuery("Conversation Memory", "Complete it", "Completes Fallout Shelter");
    await runQuery("Conversation Memory", "Launch it again", "Launches Fallout Shelter again");
    await runQuery("Conversation Memory", "Add it to RPG Collection", "Adds Fallout Shelter to RPG Collection (auto-creates RPG if not exists)");
    await runQuery("Conversation Memory", "Remove it", "Removes Fallout Shelter from RPG Collection");

    // 7. Ambiguous Games Flow
    await runQuery("Ambiguous Resolution", "Launch Fallout", "Prompts for clarification");
    await runQuery("Ambiguous Resolution", "Fallout 4", "Resolves to Fallout 4 and launches");
    await runQuery("Ambiguous Resolution", "Rate it", "Rates Fallout 4 (prompts for rating)");
    await runQuery("Ambiguous Resolution", "9", "Resolves rating to 9");
    await runQuery("Ambiguous Resolution", "Complete it", "Completes Fallout 4");

    // 8. Error Handling Scenarios
    await runQuery("Error Handling", "Launch UnknownGame123", "Fails gracefully with friendly message");
    await runQuery("Error Handling", "Rate UnknownGame123", "Fails gracefully with friendly message");
    await runQuery("Error Handling", "Complete UnknownGame123", "Fails gracefully with friendly message");
    await runQuery("Error Handling", "Review UnknownGame123", "Fails gracefully with friendly message");

    // 9. Invalid Inputs Scenarios
    await runQuery("Invalid Inputs", "Launch", "Prompts for clarification (missing game)");
    await runQuery("Invalid Inputs", "Rate", "Prompts for clarification (missing game/rating)");
    await runQuery("Invalid Inputs", "Complete", "Prompts for clarification (missing game)");
    await runQuery("Invalid Inputs", "Create Collection", "Prompts for clarification (missing collection name)");

    // 10. Multi-Intent Scenarios
    await runQuery("Multi-Intent", "Complete Fallout Shelter and rate it 9", "Executes complete then rate");
    await runQuery("Multi-Intent", "Create RPG Collection and add Fallout Shelter", "Creates RPG Collection and adds Fallout Shelter");
    await runQuery("Multi-Intent", "Launch Fallout Shelter and review it", "Launches Fallout Shelter and reviews it");

    // 11. Natural Language Robustness Scenarios
    await runQuery("NL Robustness", "Please launch Fallout Shelter", "Launches Fallout Shelter");
    await runQuery("NL Robustness", "Can you launch Fallout Shelter?", "Launches Fallout Shelter");
    await runQuery("NL Robustness", "Open Fallout Shelter", "Launches Fallout Shelter");
    await runQuery("NL Robustness", "Start Fallout Shelter", "Launches Fallout Shelter");
    await runQuery("NL Robustness", "Play Fallout Shelter", "Launches Fallout Shelter");
    await runQuery("NL Robustness", "launch fallout shelter", "Launches Fallout Shelter (lowercase)");
    await runQuery("NL Robustness", "LAUNCH FALLOUT SHELTER", "Launches Fallout Shelter (uppercase)");
    await runQuery("NL Robustness", "   Launch    Fallout    Shelter   ", "Launches Fallout Shelter (spaces)");

    // Save report to markdown
    console.log("\n========================================");
    console.log("ALL SCENARIOS FINISHED. GENERATING MARKDOWN REPORT DATA...");
    console.log("========================================\n");

    console.log(JSON.stringify(testResults, null, 2));

  } catch (error: any) {
    console.error("API Error in verification runner:", error.message);
  }
}

runScenarios();
