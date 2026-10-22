import mongoose from "mongoose";

/**
 * Records a tombstone for every document an app delete removes, so the deletion can be synced.
 * Applied to each synced schema (see syncCollections.ts). Sync itself applies remote deletes
 * through the raw collection, which skips these hooks -- a pulled delete isn't pushed back.
 */
export function tombstonePlugin(schema: mongoose.Schema, options: { coll: string }) {
  const { coll } = options;

  const record = async (docs: { _id: unknown; userId?: unknown }[]) => {
    const rows = docs
      .filter((d) => d && d._id && d.userId)
      .map((d) => ({ coll, docId: d._id, userId: d.userId, deletedAt: new Date(), pushed: false }));
    if (rows.length === 0) return;
    // Lazy lookup: syncModels imports nothing from the app, and model files import this plugin.
    await mongoose.model("SyncTombstone").insertMany(rows, { ordered: false });
  };

  // Query deletes: find what's about to go first; the post hook can't see deleted documents.
  schema.pre(["deleteOne", "deleteMany"], { query: true, document: false }, async function (this: any) {
    const q = this.model.find(this.getFilter()).select("_id userId").lean();
    this._syncDeleted = await (this.op === "deleteOne" ? q.limit(1) : q);
  });
  schema.post(["deleteOne", "deleteMany"], { query: true, document: false }, async function (this: any) {
    await record(this._syncDeleted ?? []);
  });

  // findOneAndDelete / findByIdAndDelete return the deleted document.
  schema.post("findOneAndDelete", async function (doc: any) {
    if (doc) await record([doc]);
  });

  // doc.deleteOne()
  schema.post("deleteOne", { document: true, query: false }, async function (this: any) {
    await record([this]);
  });
}
