import mongoose from "mongoose";
import Note from "./Notemodel";
import activityService from "../activity/activityService";

const getNotesForGame = async (userId: string, gameId: string) => {
  return Note.find({ userId, gameId }).sort({ createdAt: -1 });
};

const createNote = async (userId: string, gameId: string, content: string) => {
  const note = await Note.create({ userId, gameId, content: content.trim() });

  await activityService.createActivity(
    userId,
    "NOTE_CREATED",
    "Added a note",
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
      "Deleted a note",
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
