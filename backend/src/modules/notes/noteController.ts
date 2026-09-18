import { Request, Response } from "express";
import noteService from "./noteService";

const getNotesForGame = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;

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

    if (!content || !content.trim()) {
      return res.status(400).json({ Status: "Failed", Message: "Note content is required" });
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

    if (!content || !content.trim()) {
      return res.status(400).json({ Status: "Failed", Message: "Note content is required" });
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
