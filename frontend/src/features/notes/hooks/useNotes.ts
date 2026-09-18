import { useCallback, useEffect, useState } from "react";
import { useToast } from "@chakra-ui/react";

import noteApi from "../api/noteApi";
import type { Note } from "../types/note";

export function useNotes(gameId: string | undefined) {
  const toast = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!gameId) {
      setNotes([]);
      return;
    }

    try {
      setLoading(true);
      const data = await noteApi.getNotes(gameId);
      setNotes(data);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async (content: string) => {
    if (!gameId || !content.trim()) return;

    try {
      setSaving(true);
      const created = await noteApi.createNote(gameId, content);
      setNotes((prev) => [created, ...prev]);
    } catch {
      toast({
        title: "Failed to add note",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const removeNote = async (noteId: string) => {
    const previous = notes;
    setNotes((prev) => prev.filter((n) => n._id !== noteId));

    try {
      await noteApi.deleteNote(noteId);
    } catch {
      setNotes(previous);
      toast({
        title: "Failed to delete note",
        status: "error",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  return { notes, loading, saving, addNote, removeNote };
}
