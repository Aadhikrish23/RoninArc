import api from "../../../shared/api/axiosInstance";
import type { Note } from "../types/note";

const getNotes = async (gameId: string): Promise<Note[]> => {
  const response = await api.get<{ Data: Note[] }>(`/notes/${gameId}`);
  return response.data.Data;
};

const createNote = async (gameId: string, content: string): Promise<Note> => {
  const response = await api.post<{ Data: Note }>(`/notes/${gameId}`, { content });
  return response.data.Data;
};

const updateNote = async (noteId: string, content: string): Promise<Note> => {
  const response = await api.patch<{ Data: Note }>(`/notes/${noteId}`, { content });
  return response.data.Data;
};

const deleteNote = async (noteId: string): Promise<void> => {
  await api.delete(`/notes/${noteId}`);
};

export default { getNotes, createNote, updateNote, deleteNote };
