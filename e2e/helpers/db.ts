import path from "node:path";
import { MONGO_URL } from "../env";

// The backend's own driver (a mongoose dependency), so the tests add no package.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MongoClient } = require(path.resolve(__dirname, "../../backend/node_modules/mongodb"));

/** The PC backend's database in the e2e run (see playwright.config.ts). */
const PC_DB = "RoninArc_e2e";

/**
 * Makes an account look like one created on a PC before email sign-in: no email and no display
 * name, only its old (internal) username. Returns that username.
 */
export async function makeLegacyPcAccount(email: string): Promise<string> {
  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
    const users = client.db(PC_DB).collection("users");
    const user = await users.findOne({ email: email.toLowerCase() });
    if (!user) throw new Error(`no PC account with ${email}`);
    await users.updateOne({ _id: user._id }, { $unset: { email: "", displayName: "" } });
    return user.username as string;
  } finally {
    await client.close();
  }
}
