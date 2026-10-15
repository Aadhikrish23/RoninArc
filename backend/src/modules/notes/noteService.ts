import mongoose from "mongoose";
import Note from "./Notemodel";
import activityService from "../activity/activityService";
import LibraryGame from "../library/LibraryGame";

/** "Added a note to Hades" reads better in the activity feed than "Added a note". */
const titleOf = async (userId: string, gameId: unknown) =>
  ((await LibraryGame.findOne({ _id: String(gameId), userId }).select("title").lean()) as { title?: string } | null)?.title;

const noteLabel = async (prefix: string, userId: string, gameId: unknown, fallback: string) => {
  const title = await titleOf(userId, gameId);
  return title ? `${prefix} ${title}` : fallback;
};

const getNotesForGame = async (userId: string, gameId: string) => {
  return Note.find({ userId, gameId }).sort({ createdAt: -1 });
};

const createNote = async (userId: string, gameId: string, content: string) => {
  const note = await Note.create({ userId, gameId, content: content.trim() });

  await activityService.createActivity(
    userId,
    "NOTE_CREATED",
    await noteLabel("Added a note to", userId, gameId, "Added a note"),
    new mongoose.Types.ObjectId(gameId),
  );

  return note;
};

const updateNote = async (userId: string, noteId: string, content: string) => {
  return Note.findOneAndUpdate(
    { _id: noteId, userId },
    { content: content.trim() },
    { new: true, runValidators: true },
  );
};

const deleteNote = async (userId: string, noteId: string) => {
  const note = await Note.findOneAndDelete({ _id: noteId, userId });

  if (note) {
    await activityService.createActivity(
      userId,
      "NOTE_DELETED",
      await noteLabel("Deleted a note on", userId, note.gameId, "Deleted a note"),
      note.gameId,
    );
  }

  return note;
};

export default {
  getNotesForGame,
  createNote,
  updateNote,
  deleteNote,
};
