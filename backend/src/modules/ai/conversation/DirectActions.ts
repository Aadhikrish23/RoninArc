import { Types } from "mongoose";
import CollectionModel from "../../collection/CollectionModel";
import collectionService from "../../collection/collectionService";
import type { CollectionCommand } from "./FollowUps";

/** Deletes or renames a collection by name. Deleting returns a confirmation step first. */
export type CollectionActionResult =
  | { kind: "reply"; message: string; success: boolean }
  | { kind: "confirm"; question: string; label: string; run: () => Promise<string> };

export async function runCollectionCommand(userId: string, command: CollectionCommand, collections: string[]): Promise<CollectionActionResult> {
  if (!command.name) {
    if (collections.length === 0) return { kind: "reply", success: true, message: "You don't have any collections yet." };
    const which = command.kind === "delete" ? "delete" : "rename";
    return {
      kind: "reply",
      success: false,
      message: `Which collection should I ${which}? You have: ${collections.map((c) => `"${c}"`).join(", ")}.`,
    };
  }
  const col = await CollectionModel.findOne({ userId: new Types.ObjectId(userId), name: command.name }).select("_id name gameIds").lean();
  if (!col) return { kind: "reply", success: false, message: `I couldn't find a collection called "${command.name}".` };

  if (command.kind === "rename") {
    try {
      await collectionService.updateCollection(userId, String(col._id), command.newName);
      return { kind: "reply", success: true, message: `I've renamed the collection "${col.name}" to "${command.newName}".` };
    } catch (error: any) {
      return { kind: "reply", success: false, message: error?.message === "Collection with this name already exists"
        ? `You already have a collection called "${command.newName}".`
        : `I couldn't rename "${col.name}".` };
    }
  }

  const count = (col.gameIds ?? []).length;
  return {
    kind: "confirm",
    label: `the collection "${col.name}"`,
    question: `Delete the collection "${col.name}"? ${count === 0 ? "It's empty." : count === 1 ? "The game in it stays in your library." : `The ${count} games in it stay in your library.`}`,
    run: async () => {
      await collectionService.deleteCollection(userId, String(col._id));
      return `I've deleted the collection "${col.name}".`;
    },
  };
}
