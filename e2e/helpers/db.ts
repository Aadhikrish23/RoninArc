import path from "node:path";
import { MONGO_URL } from "../env";

// The backend's own driver (a mongoose dependency), so the tests add no package.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MongoClient, ObjectId } = require(path.resolve(__dirname, "../../backend/node_modules/mongodb"));

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

/** The cloud's database in the e2e run (see playwright.config.ts). */
export const CLOUD_DB = "RoninArc_cloud_e2e";
export const PC_DATABASE = PC_DB;

async function withDb<T>(dbName: string, fn: (db: any, ObjectId: any) => Promise<T>): Promise<T> {
  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
    return await fn(client.db(dbName), ObjectId);
  } finally {
    await client.close();
  }
}

/** Names of a collection's indexes. */
export const indexNames = (dbName: string, coll: string): Promise<string[]> =>
  withDb(dbName, async (db) => (await db.collection(coll).indexes()).map((i: any) => i.name as string));

/** The stored refresh-token values for an account. */
export const storedRefreshTokens = (dbName: string, userId: string): Promise<string[]> =>
  withDb(dbName, async (db, ObjectId) =>
    (await db.collection("refreshtokens").find({ userId: new ObjectId(userId) }).toArray()).map((r: any) => r.token as string),
  );

/** A refresh token stored the old way (raw), as accounts had before tokens were hashed. */
export const insertLegacyRefreshToken = (dbName: string, userId: string, token: string): Promise<void> =>
  withDb(dbName, async (db, ObjectId) => {
    await db.collection("refreshtokens").insertOne({ userId: new ObjectId(userId), token, expiresAt: new Date(Date.now() + 86_400_000), createdAt: new Date(), updatedAt: new Date() });
  });

/** Writes a document straight into a collection, as a bug or a bypass of the API could. Ids may be hex strings. */
export const insertRaw = (dbName: string, coll: string, doc: Record<string, any>): Promise<void> =>
  withDb(dbName, async (db, ObjectId) => {
    const fix = (v: any): any =>
      typeof v === "string" && /^[0-9a-f]{24}$/.test(v) ? new ObjectId(v) : Array.isArray(v) ? v.map(fix) : v;
    await db.collection(coll).insertOne(Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, fix(v)])));
  });
