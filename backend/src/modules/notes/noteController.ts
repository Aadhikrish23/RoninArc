import { Request, Response } from "express";
import { Types } from "mongoose";
import noteService from "./noteService";
import gameLibrarymodel from "../library/LibraryGame";

const MAX_NOTE_LENGTH = 2000;

// Returns an error message for invalid content, or null when it's fine.
function validateContent(content: unknown): string | null {
  if (typeof content !== "string" || !content.trim()) {
    return "Note content is required";
  }
  if (content.trim().length > MAX_NOTE_LENGTH) {
    return `Note must be ${MAX_NOTE_LENGTH} characters or fewer`;
  }
  return null;
}

const getNotesForGame = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    if (!Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ Status: "Failed", Message: "Invalid game id" });
    }
    const notes = await noteService.getNotesForGame(userId, gameId);
    return res.status(200).json({ Status: "Success", Data: notes });
  } catch (error) {
    return res.status(500).json({ Status: "Failed", Message: "Failed to fetch notes" });
  }
};

const createNote = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    const { content } = req.body;

    const contentError = validateContent(content);
    if (contentError) {
      return res.status(400).json({ Status: "Failed", Message: contentError });
    }
    if (!Types.ObjectId.isValid(gameId)) {
      return res.status(400).json({ Status: "Failed", Message: "Invalid game id" });
    }
    if (!(await gameLibrarymodel.exists({ _id: gameId, userId }))) {
      return res.status(404).json({ Status: "Failed", Message: "Game not found in your library" });
    }

    const note = await noteService.createNote(userId, gameId, content);
    return res.status(201).json({ Status: "Success", Data: note });
  } catch (error) {
    return res.status(500).json({ Status: "Failed", Message: "Failed to create note" });
  }
};

const updateNote = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;
    const { content } = req.body;

    const contentError = validateContent(content);
    if (contentError) {
      return res.status(400).json({ Status: "Failed", Message: contentError });
    }
    if (!Types.ObjectId.isValid(noteId)) {
      return res.status(404).json({ Status: "Failed", Message: "Note not found" });
    }

    const note = await noteService.updateNote(userId, noteId, content);
    if (!note) {
      return res.status(404).json({ Status: "Failed", Message: "Note not found" });
    }
    return res.status(200).json({ Status: "Success", Data: note });
  } catch (error) {
    return res.status(500).json({ Status: "Failed", Message: "Failed to update note" });
  }
};

const deleteNote = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { noteId } = req.params;
    if (!Types.ObjectId.isValid(noteId)) {
      return res.status(404).json({ Status: "Failed", Message: "Note not found" });
    }
    const note = await noteService.deleteNote(userId, noteId);
    if (!note) {
      return res.status(404).json({ Status: "Failed", Message: "Note not found" });
    }
    return res.status(200).json({ Status: "Success", Message: "Note deleted" });
  } catch (error) {
    return res.status(500).json({ Status: "Failed", Message: "Failed to delete note" });
  }
};

export default { getNotesForGame, createNote, updateNote, deleteNote };
